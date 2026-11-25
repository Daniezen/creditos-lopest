import { describe, expect, it } from "vitest";

import { construirAgenda } from "../agenda";
import { calcularCuentasCasa, calcularCuentasNegocio, calcularDineroFamilia } from "../cuentas-mes";
import { calcularFijosDelMes, calcularSobresDelMes, fijoTocaEnMes } from "../fijos-sobres";
import { calcularFlujo } from "../flujo";
import { calcularMes } from "../mes";
import { CUENTAS, GASTOS_FIJOS, HOY, MES, NOVIEMBRE } from "./lienzo.fixture";

const nov = calcularMes(NOVIEMBRE);

describe("las cuentas del mes · lienzo", () => {
  it("negocio: ganancia 6.060.000 y reinvertido 560.000", () => {
    expect(nov.negocio).toEqual({
      intereses: 6_240_000, gastos: 180_000, perdidos: 0, ganancia: 6_060_000, retirosCasa: 5_500_000, reinvertido: 560_000,
    });
  });

  it("casa: hoy 833.000, al cierre 631.000, si se gastan los sobres −1.499.000", () => {
    expect(nov.casa).toEqual({
      entro: 5_500_000, fijos: 2_727_000, variables: 1_940_000, hoy: 833_000,
      fijosSinPagar: 202_000, alCierre: 631_000, quedaEnSobres: 2_130_000, siSeGastanSobres: -1_499_000,
    });
  });

  it("negocio: perdidos restan de la ganancia; reinvertido negativo cuando se retira de más", () => {
    const c = calcularCuentasNegocio({ interesesCobrados: 3_300_000, gastos: 0, perdidos: 300_000, retirosCasa: 5_000_000 });
    expect(c.ganancia).toBe(3_000_000);
    expect(c.reinvertido).toBe(-2_000_000);
  });

  it("casa: ingresos extra suman a lo que entró; sobres netos negativos no restan más", () => {
    const c = calcularCuentasCasa({
      ingresos: { retirosRecibidos: 1_000_000, ingresosExtra: 200_000 }, fijos: 500_000, variables: 900_000, fijosSinPagar: 100_000, quedaEnSobres: -50_000,
    });
    expect(c).toMatchObject({ entro: 1_200_000, hoy: -200_000, alCierre: -300_000, quedaEnSobres: 0, siSeGastanSobres: -300_000 });
  });

  it("rechaza montos que no son enteros de pesos", () => {
    expect(() => calcularCuentasNegocio({ interesesCobrados: 10.5, gastos: 0, perdidos: 0, retirosCasa: 0 })).toThrow(RangeError);
  });

  it("familia: 22.659.000 en cuentas, la cartera aparte y sin sumar", () => {
    const f = calcularDineroFamilia(CUENTAS, { capitalPendiente: 186_400_000, creditosActivos: 42 });
    expect(f.total).toBe(22_659_000);
    expect(f.porAmbito).toEqual({ NEGOCIO: 14_820_000, CASA: 7_839_000 });
    expect(f.cuentas.map((c) => c.nombre)).toEqual(["Bancolombia", "Nu · ahorro", "Nequi", "Efectivo", "Cuenta casa"]);
    expect(f.enLaCalle).toEqual({ capitalPendiente: 186_400_000, creditosActivos: 42 });
    expect(f.cuentas.reduce((s, c) => s + c.participacionBp, 0)).toBeGreaterThanOrEqual(9_998);
  });

  it("familia sin plata: participación 0 sin dividir por cero", () => {
    const f = calcularDineroFamilia([{ ...CUENTAS[0], saldo: 0 }], { capitalPendiente: 0, creditosActivos: 0 });
    expect(f.cuentas[0].participacionBp).toBe(0);
  });
});

describe("por dónde pasó la plata", () => {
  it("los tres pasos del lienzo", () => {
    const [p1, p2, p3] = nov.flujo.pasos;
    expect(p1.total).toBe(16_040_000);
    expect(p1.partes).toEqual([
      { id: "intereses", label: "Intereses", monto: 6_240_000 },
      { id: "capital", label: "Capital que devolvieron", monto: 9_800_000 },
    ]);
    expect(p2.total).toBe(16_040_000);
    expect(p2.partes.map((p) => [p.id, p.monto])).toEqual([
      ["prestamosNuevos", 3_000_000], ["gastos", 180_000], ["aLaCasa", 5_500_000], ["quedoEnCuentas", 7_360_000],
    ]);
    expect(p3.total).toBe(5_500_000);
    expect(p3.partes.map((p) => [p.id, p.monto])).toEqual([["fijos", 2_727_000], ["variables", 1_940_000], ["sobra", 833_000]]);
    expect(nov.flujo.gastosNegocio).toBe(180_000);
    expect(nov.flujo.faltoEnCasa).toBe(0);
  });

  it("cuando sale más de lo que entró, aparece «De lo que había» y los pasos siguen sumando igual", () => {
    const f = calcularFlujo(
      { interesesCobrados: 1_000_000, capitalCobrado: 2_000_000, aportes: 500_000, desembolsos: 4_000_000, gastos: 100_000, retirosCasa: 1_000_000 },
      { entro: 1_000_000, fijos: 800_000, variables: 400_000 },
    );
    const [p1, p2, p3] = f.pasos;
    expect(p1.partes.find((p) => p.id === "deLoQueHabia")?.monto).toBe(1_600_000);
    expect(p1.total).toBe(5_100_000);
    expect(p2.total).toBe(p1.total);
    expect(p2.partes.some((p) => p.id === "quedoEnCuentas")).toBe(false);
    for (const p of f.pasos) expect(p.partes.reduce((s, x) => s + x.monto, 0)).toBe(p.total);
    expect(p3.total).toBe(1_200_000);
    expect(f.faltoEnCasa).toBe(200_000);
  });
});

describe("fijos del mes", () => {
  it("estados del lienzo al 25 de noviembre", () => {
    const e = Object.fromEntries(nov.fijos.map((f) => [f.id, [f.estado, f.pendiente]]));
    expect(e).toEqual({
      davivienda: ["PAGADO", 0], arriendo: ["PAGADO", 0], internet: ["PAGADO", 0],
      funeraria: ["SIN_PAGAR", 32_000], segBolo: ["SIN_PAGAR", 170_000],
      impBolo: ["NO_TOCA", 0], soatBolo: ["NO_TOCA", 0], tecnoBolo: ["NO_TOCA", 0],
    });
    expect(nov.fijos.find((f) => f.id === "soatBolo")?.mesQueToca).toBe("agosto");
    expect(nov.fijos.find((f) => f.id === "arriendo")?.pagadoEl).toBe("2026-11-17");
  });

  it("el día de su fecha todavía no está sin pagar; al día siguiente sí", () => {
    const fijo = [GASTOS_FIJOS[3]]; // Funeraria, día 16
    expect(calcularFijosDelMes(fijo, [], MES, "2026-11-16")[0].estado).toBe("POR_VENIR");
    expect(calcularFijosDelMes(fijo, [], MES, "2026-11-17")[0].estado).toBe("SIN_PAGAR");
  });

  it("los anuales solo cuentan en su mes", () => {
    const soat = GASTOS_FIJOS.find((f) => f.id === "soatBolo")!;
    expect(fijoTocaEnMes(soat, "2026-08")).toBe(true);
    expect(fijoTocaEnMes(soat, "2026-07")).toBe(false);
    const [ago] = calcularFijosDelMes([soat], [], "2026-08", "2026-08-01");
    expect(ago).toMatchObject({ estado: "POR_VENIR", pendiente: 660_000, vence: "2026-08-10" });
  });

  it("un anual sin mes configurado es un error de configuración", () => {
    expect(() => fijoTocaEnMes({ id: "x", nombre: "X", monto: 1, periodicidad: "ANUAL", diaPago: 1 }, MES)).toThrow(RangeError);
  });

  it("pago parcial queda sin pagar por la diferencia; un pago tardío cuenta para su mes", () => {
    const [f] = calcularFijosDelMes([GASTOS_FIJOS[1]], [{ gastoId: "arriendo", fecha: "2026-11-17", monto: 1_000_000 }], MES, HOY);
    expect(f).toMatchObject({ estado: "SIN_PAGAR", pagado: 1_000_000, pendiente: 787_000 });
    const tardio = [{ gastoId: "arriendo", fecha: "2026-12-02", monto: 1_787_000, mes: "2026-11" }];
    expect(calcularFijosDelMes([GASTOS_FIJOS[1]], tardio, MES, "2026-12-03")[0].estado).toBe("PAGADO");
    expect(calcularFijosDelMes([GASTOS_FIJOS[1]], tardio, "2026-12", "2026-12-03")[0].estado).toBe("POR_VENIR");
  });

  it("día 31 cae en el último día de meses cortos", () => {
    const f = { id: "x", nombre: "X", monto: 10, periodicidad: "MENSUAL" as const, diaPago: 31 };
    expect(calcularFijosDelMes([f], [], "2027-02", "2027-02-01")[0].vence).toBe("2027-02-28");
    expect(calcularFijosDelMes([f], [], "2028-02", "2028-02-01")[0].vence).toBe("2028-02-29");
  });

  it("un fijo sin monto nunca queda sin pagar", () => {
    const f = { id: "x", nombre: "Seguros Nando", monto: 0, periodicidad: "MENSUAL" as const, diaPago: 1 };
    expect(calcularFijosDelMes([f], [], MES, HOY)[0]).toMatchObject({ estado: "POR_VENIR", pendiente: 0 });
  });
});

describe("sobres del mes", () => {
  it("gastado, queda, porcentaje y nivel del lienzo", () => {
    const s = Object.fromEntries(nov.sobres.sobres.map((x) => [x.id, [x.gastado, x.queda, x.porcentaje, x.nivel]]));
    expect(s).toEqual({
      mercado: [1_210_000, 1_490_000, 44, "NORMAL"],
      epm: [312_000, 158_000, 66, "NORMAL"],
      gasolina: [186_000, 14_000, 93, "CERCA"],
      salud: [72_000, -22_000, 144, "PASADO"],
      entretenimiento: [60_000, 90_000, 40, "NORMAL"],
      imprevistos: [100_000, 400_000, 20, "NORMAL"],
    });
    expect(nov.sobres).toMatchObject({ topeTotal: 4_070_000, gastadoTotal: 1_940_000, quedaTotal: 2_130_000, sinSobre: 0 });
  });

  it("bordes del nivel: 89,99 % normal, 90 % cerca, 100 % cerca, 100 % + 1 pasado", () => {
    const sobre = [{ id: "s", nombre: "S", tope: 1_000_000 }];
    const nivel = (g: number) => calcularSobresDelMes(sobre, [{ sobreId: "s", fecha: "2026-11-01", monto: g }], MES).sobres[0];
    expect(nivel(899_999)).toMatchObject({ nivel: "NORMAL", porcentaje: 89 });
    expect(nivel(900_000)).toMatchObject({ nivel: "CERCA", porcentaje: 90 });
    expect(nivel(1_000_000).nivel).toBe("CERCA");
    expect(nivel(1_000_001).nivel).toBe("PASADO");
  });

  it("el umbral es configurable", () => {
    const r = calcularSobresDelMes([{ id: "s", nombre: "S", tope: 100 }], [{ sobreId: "s", fecha: "2026-11-01", monto: 75 }], MES, 75);
    expect(r.sobres[0].nivel).toBe("CERCA");
  });

  it("gastos sin sobre o de un sobre archivado cuentan como variables pero no gastan sobres", () => {
    const r = calcularSobresDelMes([{ id: "s", nombre: "S", tope: 100 }], [
      { sobreId: null, fecha: "2026-11-01", monto: 30 }, { sobreId: "viejo", fecha: "2026-11-02", monto: 20 },
    ], MES);
    expect(r).toMatchObject({ gastadoTotal: 50, sinSobre: 50, quedaTotal: 100 });
  });

  it("tope 0: sin porcentaje; cualquier gasto lo pasa", () => {
    const r = calcularSobresDelMes([{ id: "s", nombre: "S", tope: 0 }], [{ sobreId: "s", fecha: "2026-11-01", monto: 1 }], MES);
    expect(r.sobres[0]).toMatchObject({ porcentaje: null, nivel: "PASADO" });
    const vacio = calcularSobresDelMes([{ id: "s", nombre: "S", tope: 0 }], [], MES);
    expect(vacio.sobres[0].nivel).toBe("NORMAL");
  });
});

describe("agenda del mes", () => {
  const { eventos, porDia } = nov.agenda;
  const de = (d: number) => (porDia[d] ?? []).map((e) => [e.tipo, e.estado, e.texto, e.detalle, e.accion]);

  it("día 1: cobros hechos y el retiro de 3,0 M", () => {
    expect(de(1)).toEqual([
      ["COBRO_HECHO", "HECHO", "6 cobros", "6 cuotas cobradas · $ 2.140.000", null],
      ["RETIRO", "HECHO", "Retiro +3,0 M", "$ 3.000.000 · Bancolombia → Cuenta casa", null],
    ]);
  });

  it("día 16: Davivienda pagado y Funeraria sin pagar con acción pagar", () => {
    expect(de(16)).toEqual([
      ["PAGO_CASA", "HECHO", "Crédito Davivienda", "$ 820.000 · pagado el 16", null],
      ["SIN_PAGAR", "SIN_PAGAR", "Funeraria", "$ 32.000 · sin pagar desde el 16", "PAGAR"],
    ]);
  });

  it("hoy: 5 cuotas por cobrar hoy entre 5 clientes, con ver cuotas", () => {
    const [e] = porDia[25];
    expect(e).toMatchObject({
      tipo: "COBRO_ESPERADO", estado: "POR_VENIR", texto: "5 cobros", titulo: "5 cuotas por cobrar hoy",
      detalle: "$ 1.720.000 entre 5 clientes", monto: 1_720_000, accion: "VER_CUOTAS",
    });
    expect(e.refs).toHaveLength(5);
  });

  it("el 27 ignora la cuota ya pagada; cierre el 30 con lo que hoy iría al ahorro", () => {
    expect(porDia[27][0]).toMatchObject({ texto: "2 cobros", titulo: "2 cuotas por cobrar", monto: 600_000 });
    expect(porDia[30]).toEqual([expect.objectContaining({
      tipo: "CIERRE", estado: "POR_VENIR", titulo: "Cierre de noviembre",
      detalle: "Pasar lo que sobre al ahorro · hoy serían $ 631.000", accion: "IR_A_AHORRO", monto: 631_000,
    })]);
  });

  it("eventos ordenados por día y días sin eventos ausentes", () => {
    const dias = eventos.map((e) => e.diaDelMes);
    expect(dias).toEqual([...dias].sort((a, b) => a - b));
    expect(porDia[2]).toBeUndefined();
    expect(Object.keys(porDia).map(Number)).toEqual([1, 5, 10, 15, 16, 17, 20, 24, 25, 27, 30]);
  });

  it("cuotas vencidas quedan sin pagar; fijos por venir llevan acción pagar; cierre pasado sin acción si no sobró", () => {
    const a = construirAgenda({
      mes: MES, hoy: "2026-12-02",
      cobrosHechos: [], retiros: [], alCierre: -10,
      cuotas: [{ creditoId: "k", fechaProgramada: "2026-11-10", pendiente: 300_000 }],
      fijos: calcularFijosDelMes([GASTOS_FIJOS[1]], [], MES, "2026-11-05"),
    });
    expect(a.porDia[10][0]).toMatchObject({ estado: "SIN_PAGAR", titulo: "1 cuota sin pagar", detalle: "$ 300.000 · sin pagar desde el 10" });
    expect(a.porDia[17][0]).toMatchObject({ tipo: "PAGO_CASA", estado: "POR_VENIR", detalle: "$ 1.787.000 · vence el 17", accion: "PAGAR" });
    expect(a.porDia[30][0]).toMatchObject({ estado: "HECHO", detalle: "No sobró para el ahorro", accion: null });
  });

  it("solo entra lo del mes", () => {
    const a = construirAgenda({
      mes: MES, hoy: HOY, cuotas: [], fijos: [], alCierre: 0,
      cobrosHechos: [{ creditoId: "x", fecha: "2026-10-31", monto: 1 }],
      retiros: [{ id: "r", fecha: "2026-12-01", monto: 1, cuentaOrigen: "a", cuentaDestino: "b" }],
    });
    expect(a.eventos.map((e) => e.tipo)).toEqual(["CIERRE"]);
  });
});
