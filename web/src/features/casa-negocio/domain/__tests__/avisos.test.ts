import { describe, expect, it } from "vitest";

import { configAvisosPorDefecto, evaluarAvisos, REGLAS_AVISO, type EstadoAvisosInput, type ReglaAvisoId } from "../avisos";
import type { CuentasCasa, CuentasNegocio } from "../cuentas-mes";
import { calcularMes } from "../mes";
import { GASTOS_FIJOS, HOY, MES, NOVIEMBRE } from "./lienzo.fixture";

const nov = calcularMes(NOVIEMBRE);

/** The canvas month as the evaluator sees it. Each test overrides only what its rule reads. */
function estado(over: Partial<EstadoAvisosInput> = {}): EstadoAvisosInput {
  return {
    mes: MES, hoy: HOY,
    fijos: nov.fijos, sobres: nov.sobres.sobres, casa: nov.casa, negocio: nov.negocio,
    cuentas: [
      { cuentaId: "banco", nombre: "Bancolombia", desde: "2026-11-01", ultimoArqueo: { fecha: "2026-11-16", diferencia: 0 } },
      { cuentaId: "nequi", nombre: "Nequi", desde: "2026-11-01", ultimoArqueo: { fecha: "2026-11-23", diferencia: -50_000 } },
      { cuentaId: "efectivo", nombre: "Efectivo", desde: "2026-11-01", ultimoArqueo: { fecha: "2026-11-23", diferencia: 0 } },
    ],
    creditos: [],
    gastosFijos: GASTOS_FIJOS, pagosFijos: NOVIEMBRE.pagosFijos,
    cierreAnterior: { mes: "2026-10", sobrante: 7_000_000, pasadoAlAhorro: 7_000_000 },
    ...over,
  };
}

/** Evaluates with every rule off except `id`, so each test sees only its own rule. */
function solo(id: ReglaAvisoId, e: EstadoAvisosInput, umbral?: number) {
  const cfg = Object.fromEntries(REGLAS_AVISO.map((r) => [r.id, { activa: r.id === id, umbral: r.id === id && umbral !== undefined ? umbral : r.umbral }]));
  return evaluarAvisos(e, cfg);
}

const casaCon = (siSeGastanSobres: number): CuentasCasa => ({ ...nov.casa, siSeGastanSobres });
const negocioCon = (ganancia: number, retirosCasa: number): CuentasNegocio => ({ ...nov.negocio, ganancia, retirosCasa, reinvertido: ganancia - retirosCasa });

describe("evaluador de avisos · lienzo de noviembre", () => {
  it("con todo activo dispara exactamente lo que el lienzo muestra", () => {
    const a = evaluarAvisos(estado());
    expect(a.map((x) => [x.numero, x.nivel, x.texto, x.elemento])).toEqual([
      [1, "PROBLEMA", "Funeraria sin pagar desde el 16 · $ 32.000", "fijo:funeraria"],
      [1, "PROBLEMA", "Seguros Bolo sin pagar desde el 20 · $ 170.000", "fijo:segBolo"],
      [2, "ATENCION", "Gasolina va en el 93 % del tope", "sobre:gasolina"],
      [2, "ATENCION", "Salud pasó el tope por $ 22.000", "sobre:salud"],
      [3, "ATENCION", "Si se gasta lo que queda en los sobres, noviembre cierra en −$ 1.499.000.", "ecuacion:casa"],
      [4, "ATENCION", "Bancolombia sin contar hace 9 días", "cuenta:banco"],
      [5, "PROBLEMA", "Nequi: faltan $ 50.000", "cuenta:nequi"],
    ]);
    expect(a[0]).toMatchObject({ reglaId: "FIJO_VENCIDO", vistas: ["TABLERO", "CASA"], montos: { pendiente: 32_000 }, refs: ["funeraria"] });
  });

  it("una regla apagada no genera nada; la config por defecto equivale a no pasar config", () => {
    const e = estado();
    expect(evaluarAvisos(e, { FIJO_VENCIDO: { activa: false } }).some((a) => a.reglaId === "FIJO_VENCIDO")).toBe(false);
    expect(evaluarAvisos(e, configAvisosPorDefecto())).toEqual(evaluarAvisos(e));
  });

  it("umbral inválido es error de configuración", () => {
    expect(() => evaluarAvisos(estado(), { SOBRE_CERCA_TOPE: { activa: true, umbral: 90.5 } })).toThrow(RangeError);
  });
});

describe("1 · fijo sin pagar después de su fecha", () => {
  it("no dispara el mismo día de la fecha ni si está pagado", () => {
    const fijos = (hoy: string) => calcularMes({ ...NOVIEMBRE, hoy }).fijos;
    expect(solo("FIJO_VENCIDO", estado({ hoy: "2026-11-16", fijos: fijos("2026-11-16") }))).toEqual([]);
    expect(solo("FIJO_VENCIDO", estado({ hoy: "2026-11-17", fijos: fijos("2026-11-17") })).map((a) => a.elemento)).toEqual(["fijo:funeraria"]);
    expect(solo("FIJO_VENCIDO", estado({ fijos: nov.fijos.filter((f) => f.estado === "PAGADO") }))).toEqual([]);
  });
});

describe("2 · sobre al N % de su tope", () => {
  const sobre = (gastado: number, tope = 1_000) => [{ id: "s", nombre: "S", tope, gastado, queda: tope - gastado, porcentaje: null, nivel: "NORMAL" as const }];
  it("899/1000 no; 900/1000 sí; pasado sí; tope 0 nunca", () => {
    expect(solo("SOBRE_CERCA_TOPE", estado({ sobres: sobre(899) }))).toEqual([]);
    expect(solo("SOBRE_CERCA_TOPE", estado({ sobres: sobre(900) }))[0].texto).toBe("S va en el 90 % del tope");
    expect(solo("SOBRE_CERCA_TOPE", estado({ sobres: sobre(1_001) }))[0].texto).toBe("S pasó el tope por $ 1");
    expect(solo("SOBRE_CERCA_TOPE", estado({ sobres: sobre(5, 0) }))).toEqual([]);
  });
  it("respeta el umbral configurado", () => {
    expect(solo("SOBRE_CERCA_TOPE", estado({ sobres: sobre(800) }), 80)).toHaveLength(1);
    expect(solo("SOBRE_CERCA_TOPE", estado({ sobres: sobre(800) }), 81)).toEqual([]);
  });
});

describe("3 · si se gastan los sobres el mes cierra en negativo", () => {
  it("cerrar en 0 no es negativo; −1 sí", () => {
    expect(solo("SOBRES_CIERRE_NEGATIVO", estado({ casa: casaCon(0) }))).toEqual([]);
    expect(solo("SOBRES_CIERRE_NEGATIVO", estado({ casa: casaCon(-1) }))).toHaveLength(1);
  });
  it("el último día del mes aún aplica; pasado el mes ya no", () => {
    expect(solo("SOBRES_CIERRE_NEGATIVO", estado({ hoy: "2026-11-30" }))).toHaveLength(1);
    expect(solo("SOBRES_CIERRE_NEGATIVO", estado({ hoy: "2026-12-01" }))).toEqual([]);
  });
});

describe("4 · cuenta sin contar más de N días", () => {
  const cuenta = (fecha: string | null) => [{ cuentaId: "c", nombre: "C", desde: "2026-11-01", ultimoArqueo: fecha ? { fecha, diferencia: 0 } : null }];
  it("7 días no; 8 sí", () => {
    expect(solo("CUENTA_SIN_CONTAR", estado({ cuentas: cuenta("2026-11-18") }))).toEqual([]);
    expect(solo("CUENTA_SIN_CONTAR", estado({ cuentas: cuenta("2026-11-17") }))[0].texto).toBe("C sin contar hace 8 días");
  });
  it("nunca contada cuenta desde su saldo inicial", () => {
    expect(solo("CUENTA_SIN_CONTAR", estado({ cuentas: cuenta(null) }))[0].texto).toBe("C sin contar hace 24 días");
    expect(solo("CUENTA_SIN_CONTAR", estado({ hoy: "2026-11-08", cuentas: cuenta(null) }))).toEqual([]);
  });
});

describe("5 · arqueo que no cuadra", () => {
  const cuenta = (diferencia: number | null) => [{ cuentaId: "c", nombre: "C", desde: "2026-11-01", ultimoArqueo: diferencia === null ? null : { fecha: HOY, diferencia } }];
  it("cuadra o sin arqueo no; sobra o falta sí", () => {
    expect(solo("ARQUEO_NO_CUADRA", estado({ cuentas: cuenta(0) }))).toEqual([]);
    expect(solo("ARQUEO_NO_CUADRA", estado({ cuentas: cuenta(null) }))).toEqual([]);
    expect(solo("ARQUEO_NO_CUADRA", estado({ cuentas: cuenta(20_000) }))[0].texto).toBe("C: sobran $ 20.000");
    expect(solo("ARQUEO_NO_CUADRA", estado({ cuentas: cuenta(-1) }))[0]).toMatchObject({ nivel: "PROBLEMA", montos: { diferencia: -1 } });
  });
});

describe("6 · se lleva a la casa más de lo que ganó", () => {
  it("igual no; uno más sí; pérdida sin retiros no", () => {
    expect(solo("RETIRO_MAYOR_GANANCIA", estado())).toEqual([]);
    expect(solo("RETIRO_MAYOR_GANANCIA", estado({ negocio: negocioCon(5_000_000, 5_000_000) }))).toEqual([]);
    expect(solo("RETIRO_MAYOR_GANANCIA", estado({ negocio: negocioCon(3_300_000, 5_000_000) }))[0]).toMatchObject({
      texto: "En noviembre se llevó a la casa $ 1.700.000 más de lo que ganó el negocio", montos: { exceso: 1_700_000 },
    });
    expect(solo("RETIRO_MAYOR_GANANCIA", estado({ negocio: negocioCon(-100_000, 0) }))).toEqual([]);
  });
});

describe("7 · un movimiento dejaría una cuenta sin saldo", () => {
  const salida = (saldoActual: number, monto: number) => [{ cuentaId: "nequi", nombreCuenta: "Nequi", saldoActual, monto }];
  it("dejarla en 0 no; en −1 sí; sin movimiento propuesto nada", () => {
    expect(solo("CUENTA_SIN_SALDO", estado())).toEqual([]);
    expect(solo("CUENTA_SIN_SALDO", estado({ salidasPropuestas: salida(1_600_000, 1_600_000) }))).toEqual([]);
    expect(solo("CUENTA_SIN_SALDO", estado({ salidasPropuestas: salida(1_600_000, 1_600_001) }))[0]).toMatchObject({
      texto: "Nequi quedaría en −$ 1", vistas: ["ANOTAR"], montos: { quedaria: -1 },
    });
  });
});

describe("8 · crédito más de N días sin pagos", () => {
  const credito = (id: string, ultimoPago: string | null, saldoCapital = 2_800_000) => ({ creditoId: id, saldoCapital, cuotaVencidaMasAntigua: null, ultimoPago, primeraCuota: "2026-01-01" });
  it("90 días no; 91 sí, agregado como en el lienzo", () => {
    expect(solo("CREDITO_SIN_PAGOS", estado({ creditos: [credito("a", "2026-08-27")] }))).toEqual([]);
    const a = solo("CREDITO_SIN_PAGOS", estado({ creditos: [credito("a", "2026-08-26"), credito("b", "2026-05-01"), credito("c", "2026-06-01"), credito("d", HOY)] }));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ texto: "3 créditos sin pagos hace más de 90 días · $ 8,4 M", refs: ["a", "b", "c"], montos: { saldo: 8_400_000 }, elemento: "en-la-calle" });
  });
  it("créditos saldados no cuentan", () => {
    expect(solo("CREDITO_SIN_PAGOS", estado({ creditos: [credito("a", "2026-01-01", 0)] }))).toEqual([]);
  });
});

describe("9 · gasto anual vence en menos de N días", () => {
  const soat = GASTOS_FIJOS.find((f) => f.id === "soatBolo")!; // 10 de agosto
  const e = (hoy: string, pagos = NOVIEMBRE.pagosFijos) => estado({ hoy, gastosFijos: [soat], pagosFijos: pagos });
  it("a 30 días no; a 29 sí; el mismo día sí; al día siguiente ya no (es regla 1)", () => {
    expect(solo("ANUAL_POR_VENCER", e("2027-07-11"))).toEqual([]);
    expect(solo("ANUAL_POR_VENCER", e("2027-07-12"))[0].texto).toBe("SOAT Bolo vence el 10 de agosto · $ 660.000");
    expect(solo("ANUAL_POR_VENCER", e("2027-08-10"))).toHaveLength(1);
    expect(solo("ANUAL_POR_VENCER", e("2027-08-11"))).toEqual([]);
  });
  it("ya pagado no; cruza el año (diciembre → enero)", () => {
    expect(solo("ANUAL_POR_VENCER", e("2027-08-01", [{ gastoId: "soatBolo", fecha: "2027-07-20", monto: 660_000, mes: "2027-08" }]))).toEqual([]);
    const enero = { ...soat, id: "ene", nombre: "Predial", mesAnual: 1, diaPago: 5 };
    expect(solo("ANUAL_POR_VENCER", estado({ hoy: "2026-12-20", gastosFijos: [enero], pagosFijos: [] }))).toHaveLength(1);
  });
  it("mensuales y anuales sin monto no cuentan", () => {
    expect(solo("ANUAL_POR_VENCER", estado({ gastosFijos: [GASTOS_FIJOS[0], { ...soat, monto: 0 }], hoy: "2027-08-01" }))).toEqual([]);
  });
});

describe("10 · pasó el cierre y lo sobrante no está en el ahorro", () => {
  const e = (hoy: string, sobrante: number, pasadoAlAhorro: number) => estado({ hoy, cierreAnterior: { mes: "2026-11", sobrante, pasadoAlAhorro } });
  it("antes de terminar el mes no; pasado y sin mover sí", () => {
    expect(solo("CIERRE_SIN_AHORRO", e("2026-11-30", 631_000, 0))).toEqual([]);
    expect(solo("CIERRE_SIN_AHORRO", e("2026-12-01", 631_000, 0))[0].texto).toBe("Sobraron $ 631.000 de noviembre y faltan $ 631.000 por pasar al ahorro");
  });
  it("movido completo o sin sobrante no; parcial sí por la diferencia", () => {
    expect(solo("CIERRE_SIN_AHORRO", e("2026-12-01", 631_000, 631_000))).toEqual([]);
    expect(solo("CIERRE_SIN_AHORRO", e("2026-12-01", -10, 0))).toEqual([]);
    expect(solo("CIERRE_SIN_AHORRO", e("2026-12-01", 631_000, 600_000))[0].montos.falta).toBe(31_000);
    expect(solo("CIERRE_SIN_AHORRO", estado({ cierreAnterior: null }))).toEqual([]);
  });
});
