import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseNumericInput } from "../../../lib/formatters";
import {
  dateInput,
  entityId,
  fieldErrorsOf,
  formFields,
  InputValidationError,
  MAX_MONEY_PESOS,
  moneyInput,
  optionalText,
  parseColombianNumber,
  parseInput,
  pastOrTodayDateInput,
  todayInBogota,
} from "../input";

const money = moneyInput({ required: "Falta el monto.", invalid: "Monto inválido." });

function messageOf(schema: z.ZodType, value: unknown): string | undefined {
  const result = schema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("moneyInput", () => {
  it.each([
    ["300000", 300000],
    ["300.000", 300000],
    ["$300.000", 300000],
    ["$ 1.250.000,50", 1250000.5],
    ["300,5", 300.5],
    ["  100.000  ", 100000],
    ["0,01", 0.01],
  ])("parses %j exactly like parseNumericInput", (raw, expected) => {
    expect(money.parse(raw)).toBe(expected);
    expect(parseNumericInput(raw)).toBe(expected);
  });

  it("keeps the private copy of the parser identical to the app's", () => {
    for (const raw of ["1.000,25", "$5", "abc", "", "1,2,3", " 7 "]) {
      expect(Object.is(parseColombianNumber(raw), parseNumericInput(raw))).toBe(true);
    }
  });

  it("rejects missing, zero, negative and non-numeric amounts", () => {
    expect(messageOf(money, undefined)).toBe("Falta el monto.");
    expect(messageOf(money, "   ")).toBe("Falta el monto.");
    expect(messageOf(money, "0")).toBe("Monto inválido.");
    expect(messageOf(money, "-5.000")).toBe("Monto inválido.");
    expect(messageOf(money, "abc")).toBe("Monto inválido.");
  });

  it("rejects sub-cent amounts instead of letting toFixed(2) round them", () => {
    expect(messageOf(money, "100,555")).toBe("El valor admite máximo dos decimales.");
  });

  it("caps amounts where cents stop being exact in a JS number", () => {
    expect(money.parse(String(MAX_MONEY_PESOS))).toBe(MAX_MONEY_PESOS);
    expect(Number.isSafeInteger(MAX_MONEY_PESOS * 100)).toBe(true);
    expect(messageOf(money, String(MAX_MONEY_PESOS + 1))).toBe("El valor supera el máximo permitido.");
  });
});

describe("dateInput", () => {
  const fecha = dateInput("la fecha del abono");

  it("returns local midnight, like parseDateInputValue", () => {
    const parsed = fecha.parse("2026-03-15");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2);
    expect(parsed.getDate()).toBe(15);
    expect(parsed.getHours()).toBe(0);
  });

  it("rejects malformed and impossible calendar dates", () => {
    expect(messageOf(fecha, "15/03/2026")).toBe("La fecha del abono no tiene un formato válido (AAAA-MM-DD).");
    expect(messageOf(fecha, "2026-02-30")).toBe("La fecha del abono no es una fecha válida en el calendario.");
    expect(messageOf(fecha, "2026-13-01")).toBe("La fecha del abono no es una fecha válida en el calendario.");
  });

  it("refuses days after today in America/Bogota", () => {
    const schema = pastOrTodayDateInput("la fecha", "No puede estar en el futuro.");
    const today = todayInBogota();
    const iso = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    expect(schema.parse(iso(today)).getTime()).toBe(today.getTime());
    expect(messageOf(schema, iso(tomorrow))).toBe("No puede estar en el futuro.");
  });

  it("computes today from the Bogota calendar, not the server's", () => {
    // 03:00 UTC on 1 Jan is still 31 Dec (22:00) in Bogota (UTC-5).
    const today = todayInBogota(new Date("2026-01-01T03:00:00Z"));
    expect([today.getFullYear(), today.getMonth(), today.getDate()]).toEqual([2025, 11, 31]);
  });
});

describe("entityId and text", () => {
  const id = entityId("creditoId");

  it("trims ids and accepts cuid-like and legacy ids", () => {
    expect(id.parse("  ckx1abc2def  ")).toBe("ckx1abc2def");
    expect(id.parse("role_admin-1")).toBe("role_admin-1");
  });

  it("rejects empty, oversized and unsafe ids", () => {
    expect(messageOf(id, undefined)).toBe("Falta el campo obligatorio creditoId.");
    expect(messageOf(id, "")).toBe("Falta el campo obligatorio creditoId.");
    expect(messageOf(id, "x".repeat(65))).toBe("El identificador creditoId no es válido.");
    expect(messageOf(id, "a' OR 1=1 --")).toBe("El identificador creditoId no es válido.");
  });

  it("optionalText keeps normalizeOptional semantics", () => {
    const text = optionalText({ max: 5 });
    expect(text.parse(undefined)).toBeNull();
    expect(text.parse(null)).toBeNull();
    expect(text.parse("   ")).toBeNull();
    expect(text.parse("  ab ")).toBe("ab");
    expect(text.safeParse("abcdef").success).toBe(false);
  });
});

describe("parseInput and form helpers", () => {
  const schema = z.object({ creditoId: entityId("creditoId"), monto: money });

  it("throws InputValidationError with the first message and one error per field", () => {
    let caught: unknown;
    try {
      parseInput(schema, { creditoId: "", monto: "0" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InputValidationError);
    expect((caught as Error).message).toBe("Falta el campo obligatorio creditoId.");
    expect(fieldErrorsOf(caught)).toEqual({
      creditoId: "Falta el campo obligatorio creditoId.",
      monto: "Monto inválido.",
    });
    expect(fieldErrorsOf(new Error("x"))).toBeUndefined();
  });

  it("formFields reads only the requested text fields", () => {
    const formData = new FormData();
    formData.set("creditoId", "abc");
    formData.set("file", new Blob(["x"]));
    formData.set("ignored", "y");
    expect(formFields(formData, ["creditoId", "file", "missing"] as const)).toEqual({
      creditoId: "abc",
      file: undefined,
      missing: undefined,
    });
  });
});
