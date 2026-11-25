import { describe, expect, it } from "vitest";

import { categoriaDelMes, construirHistorial, proximoVencimiento, tramoDe } from "../agregados";
import { aCentavos, sumar } from "../dinero";
import { CasaNegocioReglaError } from "../errors";
import { validarMovimiento, type CuentaRegla } from "../rules";
import { asientosDeMovimiento, desgloseCobro, resumirSaldo, saldosActuales, type Asiento } from "../saldos";

const dia = (fecha: string) => new Date(`${fecha}T05:00:00.000Z`);
const APERTURA = dia("2026-12-01");
const cuenta = (id: string, grupo: "NEGOCIO" | "CASA", extra: Partial<CuentaRegla> = {}): CuentaRegla => ({
  id,
  nombre: id,
  grupo,
  archivada: false,
  fechaSaldoInicial: APERTURA,
  ...extra,
});
const efectivo = cuenta("efectivo", "NEGOCIO");
const banco = cuenta("banco", "NEGOCIO");
const casa = cuenta("casa", "CASA");
const nu = cuenta("nu", "CASA");
const arriendo = { id: "arriendo", nombre: "Arriendo", clase: "FIJO" as const, activa: true };
const mercado = { id: "mercado", nombre: "Mercado", clase: "VARIABLE" as const, activa: true };
const fecha = dia("2026-12-05");

describe("reglas de movimientos", () => {
  const ok = (mov: Parameters<typeof validarMovimiento>[0]) => validarMovimiento(mov);
  const falla = (mov: Parameters<typeof validarMovimiento>[0], texto: string) => {
    expect(() => validarMovimiento(mov)).toThrow(CasaNegocioReglaError);
    expect(() => validarMovimiento(mov)).toThrow(texto);
  };

  it("un retiro a la casa es el traslado entre grupos", () => {
    expect(ok({ tipo: "RETIRO_CASA", fecha, origen: efectivo, destino: casa, categoria: null })).toBe("RETIRO_CASA");
    falla({ tipo: "RETIRO_CASA", fecha, origen: casa, destino: efectivo, categoria: null }, "del negocio");
  });

  it("un traslado queda dentro del grupo; pasar al ahorro es uno", () => {
    expect(ok({ tipo: "TRASLADO", fecha, origen: casa, destino: nu, categoria: null })).toBe("TRASLADO");
    expect(ok({ tipo: "TRASLADO", fecha, origen: efectivo, destino: banco, categoria: null })).toBe("TRASLADO");
    falla({ tipo: "TRASLADO", fecha, origen: efectivo, destino: casa, categoria: null }, "mismo grupo");
    falla({ tipo: "TRASLADO", fecha, origen: casa, destino: casa, categoria: null }, "la misma");
  });

  it("los gastos de la casa salen de la casa con categoría y siguen su clase", () => {
    expect(ok({ tipo: "GASTO_FIJO", fecha, origen: casa, destino: null, categoria: arriendo })).toBe("GASTO_FIJO");
    // The form said FIJO but Mercado is a variable "sobre": it is filed there.
    expect(ok({ tipo: "GASTO_FIJO", fecha, origen: casa, destino: null, categoria: mercado })).toBe("GASTO_VARIABLE");
    falla({ tipo: "GASTO_VARIABLE", fecha, origen: efectivo, destino: null, categoria: mercado }, "de la casa");
    falla({ tipo: "GASTO_VARIABLE", fecha, origen: casa, destino: null, categoria: null }, "en qué gasto");
    falla({ tipo: "GASTO_VARIABLE", fecha, origen: casa, destino: null, categoria: { ...mercado, activa: false } }, "inactivo");
  });

  it("gasto del negocio, aporte e ingreso de la casa tienen su forma", () => {
    expect(ok({ tipo: "GASTO_NEGOCIO", fecha, origen: banco, destino: null, categoria: null })).toBe("GASTO_NEGOCIO");
    falla({ tipo: "GASTO_NEGOCIO", fecha, origen: banco, destino: casa, categoria: null }, "no entra");
    falla({ tipo: "GASTO_NEGOCIO", fecha, origen: banco, destino: null, categoria: arriendo }, "Solo los gastos de la casa");
    expect(ok({ tipo: "APORTE", fecha, origen: null, destino: efectivo, categoria: null })).toBe("APORTE");
    expect(ok({ tipo: "APORTE", fecha, origen: casa, destino: efectivo, categoria: null })).toBe("APORTE");
    falla({ tipo: "APORTE", fecha, origen: banco, destino: efectivo, categoria: null }, "de una cuenta de la casa");
    expect(ok({ tipo: "INGRESO_CASA", fecha, origen: null, destino: casa, categoria: null })).toBe("INGRESO_CASA");
    falla({ tipo: "INGRESO_CASA", fecha, origen: null, destino: banco, categoria: null }, "de la casa");
  });

  it("no usa cuentas archivadas ni fechas anteriores a su saldo inicial", () => {
    falla({ tipo: "GASTO_NEGOCIO", fecha, origen: cuenta("vieja", "NEGOCIO", { archivada: true }), destino: null, categoria: null }, "archivada");
    falla({ tipo: "GASTO_NEGOCIO", fecha: dia("2026-11-30"), origen: efectivo, destino: null, categoria: null }, "arranca después");
  });
});

describe("saldos de cuenta", () => {
  const cuentas = [
    { id: "efectivo", saldoInicial: "1250000.00", fechaSaldoInicial: APERTURA },
    { id: "casa", saldoInicial: "0.10", fechaSaldoInicial: APERTURA },
  ];
  const asientos: Asiento[] = [
    // Before the opening date: already inside saldoInicial, must be ignored.
    { cuentaId: "efectivo", fecha: dia("2026-11-28"), centavos: 99_999_900 },
    ...asientosDeMovimiento({ fecha: dia("2026-12-03"), monto: "300000.00", cuentaOrigenId: "efectivo", cuentaDestinoId: "casa" }),
    ...asientosDeMovimiento({ fecha: dia("2026-12-04"), monto: "0.20", cuentaOrigenId: "casa", cuentaDestinoId: null }),
    { cuentaId: "efectivo", fecha: dia("2026-12-10"), centavos: aCentavos("125000.00") },
    { cuentaId: "efectivo", fecha: dia("2027-01-02"), centavos: -aCentavos("500000.00") },
  ];

  it("saldo inicial + entradas − salidas cuadra en centavos exactos", () => {
    const dic = { inicio: dia("2026-12-01"), fin: dia("2027-01-01") };
    const efectivoDic = resumirSaldo(cuentas[0], asientos, dic.inicio, dic.fin);
    expect(efectivoDic).toEqual({
      saldoInicial: 1_250_000,
      saldoInicio: 1_250_000,
      entradas: 125_000,
      salidas: 300_000,
      saldoFin: 1_075_000,
      saldoActual: 575_000,
    });
    // 0.10 + 300000 - 0.20 with no float residue.
    expect(resumirSaldo(cuentas[1], asientos, dic.inicio, dic.fin).saldoFin).toBe(299_999.9);
  });

  it("el saldo de inicio de un mes es el de fin del anterior", () => {
    const dic = resumirSaldo(cuentas[0], asientos, dia("2026-12-01"), dia("2027-01-01"));
    const ene = resumirSaldo(cuentas[0], asientos, dia("2027-01-01"), dia("2027-02-01"));
    expect(ene.saldoInicio).toBe(dic.saldoFin);
    expect(ene.saldoFin).toBe(ene.saldoActual);
  });

  it("la suma de saldos actuales es la suma de saldos iniciales más lo que entró y salió del sistema", () => {
    const saldos = saldosActuales(cuentas, asientos);
    // Internal transfers cancel; the external inflow (cobro) and outflows (gasto, desembolso) remain.
    expect(sumar(saldos.values())).toBe(sumar([1_250_000, 0.1, 125_000, -0.2, -500_000]));
  });

  it("desglosa el cobro como analytics, incluido el legado sin desglose", () => {
    const base = { montoPagado: 0, capitalPagado: 0, interesPagado: 0, capitalProgramado: "100000", interesProgramado: "25000" };
    expect(desgloseCobro({ ...base, tipo: "CUOTA_PROGRAMADA", montoPagado: "125000", capitalPagado: "100000", interesPagado: "25000" })).toEqual({
      capital: 100_000,
      interes: 25_000,
      total: 125_000,
    });
    expect(desgloseCobro({ ...base, tipo: "CUOTA_PROGRAMADA" })).toEqual({ capital: 100_000, interes: 25_000, total: 125_000 });
    expect(desgloseCobro({ ...base, tipo: "ABONO_CAPITAL", montoPagado: "50000" })).toEqual({ capital: 50_000, interes: 0, total: 50_000 });
  });
});

describe("agregados del mes", () => {
  it("tramos de atraso", () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(tramoDe)).toEqual(["AL_DIA", "1_30", "1_30", "31_60", "31_60", "61_90", "61_90", "MAS_90"]);
  });

  it("gastos fijos anuales vencen en su mes y el próximo vencimiento salta de año", () => {
    const soat = { periodicidad: "ANUAL" as const, mesAnual: 8, diaPago: null };
    expect(categoriaDelMes(soat, "2026-12", "2026-12-05", [])).toMatchObject({ venceEnMes: false, fechaPagoMes: null, pagadoMes: false });
    expect(categoriaDelMes(soat, "2027-08", "2026-12-05", ["660000.00"])).toMatchObject({ venceEnMes: true, fechaPagoMes: "2027-08-31", pagadoMes: true });
    expect(proximoVencimiento(soat, "2026-12-05")).toBe("2027-08-31");
    expect(proximoVencimiento({ periodicidad: "MENSUAL", mesAnual: null, diaPago: 17 }, "2026-12-18")).toBe("2027-01-17");
    expect(proximoVencimiento({ periodicidad: "MENSUAL", mesAnual: null, diaPago: null }, "2026-12-18")).toBeNull();
  });

  it("el historial suma por mes y separa depósitos al ahorro", () => {
    const historial = construirHistorial(
      "2026-12",
      {
        cobros: [
          { mes: "2026-12", capital: 100_000, interes: 25_000, total: 125_000 },
          { mes: "2026-11", capital: 1, interes: 2, total: 3 },
          { mes: "2025-01", capital: 9, interes: 9, total: 18 }, // outside the window
        ],
        desembolsos: [{ mes: "2026-12", monto: "500000.00" }],
        castigos: [{ mes: "2026-12", monto: "100000.00" }],
        movimientos: [
          { mes: "2026-12", tipo: "RETIRO_CASA", monto: "300000", tipoOrigen: "EFECTIVO", tipoDestino: "BANCO" },
          { mes: "2026-12", tipo: "TRASLADO", monto: "20000", tipoOrigen: "BANCO", tipoDestino: "AHORRO" },
          { mes: "2026-12", tipo: "TRASLADO", monto: "5000", tipoOrigen: "AHORRO", tipoDestino: "BANCO" },
          { mes: "2026-12", tipo: "TRASLADO", monto: "7000", tipoOrigen: "EFECTIVO", tipoDestino: "BANCO" },
          { mes: "2026-12", tipo: "GASTO_VARIABLE", monto: "0.10", tipoOrigen: "BANCO", tipoDestino: null },
          { mes: "2026-12", tipo: "GASTO_VARIABLE", monto: "0.20", tipoOrigen: "BANCO", tipoDestino: null },
        ],
      },
      3,
    );
    expect(historial.map((h) => h.mes)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(historial[1].interesCobrado).toBe(2);
    expect(historial[2]).toMatchObject({
      interesCobrado: 25_000,
      desembolsado: 500_000,
      perdidas: 100_000,
      retirosCasa: 300_000,
      depositosAhorro: 20_000,
      retirosAhorro: 5_000,
      gastosVariables: 0.3,
    });
  });
});
