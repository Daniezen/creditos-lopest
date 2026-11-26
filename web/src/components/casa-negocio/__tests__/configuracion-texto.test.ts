import { describe, expect, it } from "vitest";

import { CODIGOS_AVISO } from "@/features/casa-negocio/schemas";

import {
  AVISOS,
  alternarCapacidad,
  quitariaUltimoConfigurador,
  subtituloGasto,
  textoAviso,
  tipoCuentaTexto,
  tonoCuenta,
} from "../configuracion/texto";
import { inicialesDe } from "@/server/casa-negocio/vista-configuracion";

const fijo = { clase: "FIJO", periodicidad: "MENSUAL", mesAnual: null, diaPago: 17, activa: true } as const;

describe("subtítulo de un gasto", () => {
  it("fijo mensual con día, anual con mes, variable con tope", () => {
    expect(subtituloGasto(fijo).texto).toBe("Cada mes · día 17");
    expect(subtituloGasto({ ...fijo, periodicidad: "ANUAL", mesAnual: 3, diaPago: 5 }).texto).toBe("Cada año · marzo · día 5");
    expect(subtituloGasto({ ...fijo, clase: "VARIABLE" }).texto).toBe("Tope mensual");
  });

  it("un fijo sin día de pago lo dice", () => {
    expect(subtituloGasto({ ...fijo, diaPago: null })).toEqual({ texto: "Falta día de pago", faltaDia: true });
    expect(subtituloGasto({ ...fijo, periodicidad: "ANUAL", mesAnual: 8, diaPago: null }).faltaDia).toBe(true);
    expect(subtituloGasto({ ...fijo, clase: "VARIABLE", diaPago: null }).faltaDia).toBe(false);
  });
});

describe("cuentas", () => {
  it("tipo y color como el lienzo", () => {
    expect(tipoCuentaTexto("NEGOCIO", "BILLETERA")).toBe("Negocio · billetera");
    expect(tonoCuenta("CASA", "AHORRO")).toBe("ahorro");
    expect(tonoCuenta("CASA", "BANCO")).toBe("casa");
    expect(tonoCuenta("NEGOCIO", "BANCO")).toBe("banco");
  });

  it("iniciales del login", () => {
    expect(inicialesDe("Daniel Felipe Lopera")).toBe("DL");
    expect(inicialesDe("madre")).toBe("M");
    expect(inicialesDe("  ")).toBe("?");
  });
});

describe("avisos", () => {
  it("las diez reglas tienen texto, y solo las de umbral lo piden", () => {
    expect(Object.keys(AVISOS).sort()).toEqual([...CODIGOS_AVISO].sort());
    expect(textoAviso("SOBRE_CERCA_DEL_TOPE", 90)).toBe("Un sobre llega al 90 % de su tope");
    expect(textoAviso("ARQUEO_NO_CUADRA", null)).toBe("Un arqueo no cuadra");
  });
});

describe("quién puede qué", () => {
  it("prender algo prende ver; apagar ver lo apaga todo", () => {
    expect(alternarCapacidad([], "CONTAR")).toEqual(["VER", "CONTAR"]);
    expect(alternarCapacidad(["VER", "ANOTAR"], "VER")).toEqual([]);
    expect(alternarCapacidad(["VER", "ANOTAR"], "ANOTAR")).toEqual(["VER"]);
  });

  it("detecta que se quitaría el último configurador, sin contar inactivos", () => {
    const personas = [
      { userId: "yo", activo: true, capacidades: ["VER", "CONFIGURAR"] as const },
      { userId: "ex", activo: false, capacidades: ["VER", "CONFIGURAR"] as const },
      { userId: "madre", activo: true, capacidades: ["VER"] as const },
    ];
    expect(quitariaUltimoConfigurador(personas, "yo", ["VER"])).toBe(true);
    expect(quitariaUltimoConfigurador(personas, "madre", [])).toBe(false);
    expect(quitariaUltimoConfigurador([...personas, { userId: "padre", activo: true, capacidades: ["CONFIGURAR"] as const }], "yo", [])).toBe(false);
  });
});
