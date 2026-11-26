/**
 * Pure parts of the Telegram avisos digest: identity, filtering, the dedupe
 * plan and the message text. No database: the DB round trip is covered by
 * `avisos-envio.integration.test.ts`.
 */
import { describe, expect, it, vi } from "vitest";

// The module also holds the DB entry point; its import chain reaches the
// Prisma singleton, which demands DATABASE_URL at import time.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import type { Aviso } from "@/features/casa-negocio/domain";

import {
  avisosEnviables,
  claveAviso,
  mensajeTelegram,
  planificarEnvio,
  type AvisoParaEnviar,
  type AvisoRecordado,
} from "../avisos-envio";

const MES = "2026-12";

function aviso(parcial: Partial<Aviso> & Pick<Aviso, "reglaId" | "elemento">): Aviso {
  return { numero: 1, nivel: "PROBLEMA", texto: "Arriendo sin pagar desde el 17 · $ 1.787.000", vistas: ["TABLERO"], refs: [], montos: {}, ...parcial };
}

const arriendo = aviso({ reglaId: "FIJO_VENCIDO", elemento: "fijo:arriendo", refs: ["arriendo"] });
const lentos = aviso({ reglaId: "CREDITO_SIN_PAGOS", numero: 8, nivel: "ATENCION", elemento: "en-la-calle", refs: ["c2", "c1"], texto: "2 créditos sin pagos" });
const siempre = () => true;

function enviable(a: Aviso): AvisoParaEnviar {
  return avisosEnviables([a], MES, siempre)[0];
}

function recordado(a: AvisoParaEnviar, extra: Partial<AvisoRecordado> = {}): AvisoRecordado {
  return { clave: a.clave, refs: a.refs, resueltoEn: null, ...extra };
}

describe("claveAviso", () => {
  it("es regla + mes + elemento, con el código de la base", () => {
    expect(claveAviso(arriendo, MES)).toBe("FIJO_VENCIDO_SIN_PAGAR|2026-12|fijo:arriendo");
  });

  it("cambia de mes: el mismo fijo sin pagar en enero es otro hecho", () => {
    expect(claveAviso(arriendo, "2027-01")).not.toBe(claveAviso(arriendo, MES));
  });

  it("un arqueo que no cuadra por otra diferencia es un aviso nuevo", () => {
    const a = aviso({ reglaId: "ARQUEO_NO_CUADRA", elemento: "cuenta:efectivo", montos: { diferencia: -20000 } });
    const b = { ...a, montos: { diferencia: -5000 } };
    expect(claveAviso(a, MES)).not.toBe(claveAviso(b, MES));
  });

  it("acorta las identidades largas con un hash estable", () => {
    const largo = aviso({ reglaId: "FIJO_VENCIDO", elemento: `fijo:${"x".repeat(200)}` });
    expect(claveAviso(largo, MES)).toMatch(/^h:[0-9a-f]{64}$/);
    expect(claveAviso(largo, MES)).toBe(claveAviso(largo, MES));
  });
});

describe("avisosEnviables", () => {
  it("respeta el apagado de Configuración aunque el motor lo hubiera producido", () => {
    const enviables = avisosEnviables([arriendo, lentos], MES, (regla) => regla !== "CREDITO_SIN_PAGOS");
    expect(enviables.map((a) => a.codigo)).toEqual(["FIJO_VENCIDO_SIN_PAGAR"]);
  });

  it("nunca envía la regla 7: solo existe dentro del panel Anotar", () => {
    const sinSaldo = aviso({ reglaId: "CUENTA_SIN_SALDO", numero: 7, elemento: "cuenta:efectivo" });
    expect(avisosEnviables([sinSaldo], MES, siempre)).toEqual([]);
  });

  it("ordena las refs para comparar listas sin importar el orden", () => {
    expect(enviable(lentos).refs).toEqual(["c1", "c2"]);
  });
});

describe("planificarEnvio", () => {
  it("la primera vez todo es nuevo", () => {
    const plan = planificarEnvio([enviable(arriendo)], []);
    expect(plan.nuevos).toHaveLength(1);
    expect(plan.vigentes).toEqual([]);
    expect(plan.resueltos).toEqual([]);
  });

  it("al día siguiente el mismo aviso no se repite", () => {
    const a = enviable(arriendo);
    const plan = planificarEnvio([a], [recordado(a)]);
    expect(plan.nuevos).toEqual([]);
    expect(plan.vigentes).toEqual([a]);
  });

  it("si deja de aplicar se marca resuelto, y si vuelve es nuevo otra vez", () => {
    const a = enviable(arriendo);
    expect(planificarEnvio([], [recordado(a)]).resueltos).toEqual([a.clave]);
    const vuelve = planificarEnvio([a], [recordado(a, { resueltoEn: new Date() })]);
    expect(vuelve.nuevos).toEqual([a]);
  });

  it("los ya resueltos no se vuelven a resolver", () => {
    const a = enviable(arriendo);
    expect(planificarEnvio([], [recordado(a, { resueltoEn: new Date() })]).resueltos).toEqual([]);
  });

  it("un crédito que entra a la lista es noticia; uno que sale no", () => {
    const antes = enviable(lentos);
    const entra = enviable({ ...lentos, refs: ["c1", "c2", "c3"] });
    const sale = enviable({ ...lentos, refs: ["c1"] });
    expect(planificarEnvio([entra], [recordado(antes)]).nuevos).toEqual([entra]);
    expect(planificarEnvio([sale], [recordado(antes)]).nuevos).toEqual([]);
  });

  it("un aviso duplicado produce un solo mensaje", () => {
    const a = enviable(arriendo);
    expect(planificarEnvio([a, a], []).nuevos).toHaveLength(1);
  });
});

describe("mensajeTelegram", () => {
  it("sin novedades no hay mensaje", () => {
    expect(mensajeTelegram([], "2026-12-18", null)).toBeNull();
  });

  it("problemas primero, luego atención, con la fecha y el enlace", () => {
    const texto = mensajeTelegram([enviable(lentos), enviable(arriendo)], "2026-12-18", "https://lopest.example/casa-negocio");
    expect(texto).toBe(
      [
        "Casa y Negocio · 18 dic",
        "",
        "🔴 Arriendo sin pagar desde el 17 · $ 1.787.000",
        "🟡 2 créditos sin pagos",
        "",
        "https://lopest.example/casa-negocio",
      ].join("\n"),
    );
  });
});
