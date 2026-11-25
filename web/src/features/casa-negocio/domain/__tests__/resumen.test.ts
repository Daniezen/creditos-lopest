import { describe, expect, it } from "vitest";

import { sumarMeses } from "../dates";
import type { CreditoCarteraInput } from "../inputs";
import {
  calcularCumplimientoCobros,
  calcularGananciaRetiros,
  calcularTramosAtraso,
  diasAtraso,
  diasSinPagos,
  proyectarCobros,
  tramoDe,
} from "../resumen";
import { repartir } from "./lienzo.fixture";

// Resumen.dc.html series, Dec 2025 → Nov 2026, in millions with one decimal.
const M = (x: number) => Math.round(x * 1_000_000);
const GAN = [4.2, 4.4, 4.1, 4.6, 4.8, 3.3, 5.1, 5.2, 5.6, 5.8, 6.0, 6.06];
const RET = [4.0, 4.0, 4.0, 4.5, 4.5, 5.0, 5.0, 5.5, 5.2, 5.5, 5.5, 5.5];
const mesI = (i: number) => sumarMeses("2025-12", i);

describe("ganancia contra retiros", () => {
  const r = calcularGananciaRetiros(
    GAN.map((g, i) => ({ mes: mesI(i), negocio: { interesesCobrados: M(g), gastos: 0, perdidos: 0, retirosCasa: M(RET[i]) } })).reverse(),
  );

  it("marca mayo y julio: el capital bajó 2,0 M", () => {
    expect(r.mesesCapitalBajo).toEqual(["2026-05", "2026-07"]);
    expect(r.capitalPerdido).toBe(2_000_000);
  });

  it("ordena por mes y noviembre reinvierte 560.000", () => {
    expect(r.meses[0].mes).toBe("2025-12");
    expect(r.meses.at(-1)).toEqual({ mes: "2026-11", ganancia: 6_060_000, retiros: 5_500_000, reinvertido: 560_000, capitalBajo: false });
  });

  it("retirar exactamente lo ganado no baja el capital", () => {
    const e = calcularGananciaRetiros([{ mes: "2026-01", negocio: { interesesCobrados: 100, gastos: 0, perdidos: 0, retirosCasa: 100 } }]);
    expect(e.meses[0].capitalBajo).toBe(false);
    expect(e.capitalPerdido).toBe(0);
  });
});

describe("cobros: cumplimiento y proyección", () => {
  const CAP = [8.6, 8.9, 9.0, 9.4, 9.6, 9.8, 10.1, 10.3, 10.6, 10.9, 11.2, 11.4];
  const INT = [4.4, 4.5, 4.6, 4.8, 4.9, 5.0, 5.2, 5.3, 5.5, 5.6, 5.8, 5.9];
  const CUMPL = [0.97, 0.95, 0.96, 0.93, 0.95, 0.82, 0.94, 0.9, 0.96, 0.95, 0.97, 0.88];

  it("93 % de lo que tocaba cobrar en 12 meses; mayo 82 %", () => {
    const c = calcularCumplimientoCobros(CAP.map((cap, i) => ({
      mes: mesI(i),
      cobradoCapital: Math.round(M(cap) * CUMPL[i]), cobradoInteres: Math.round(M(INT[i]) * CUMPL[i]),
      esperadoCapital: M(cap), esperadoInteres: M(INT[i]),
    })));
    expect(c.cumplimiento).toBe(93);
    expect(c.esperado).toBe(181_300_000);
    expect(c.meses.find((m) => m.mes === "2026-05")?.cumplimiento).toBe(82);
  });

  it("mes sin nada programado: cumplimiento null; prepagos pueden pasar de 100", () => {
    const c = calcularCumplimientoCobros([
      { mes: "2026-01", cobradoCapital: 0, cobradoInteres: 0, esperadoCapital: 0, esperadoInteres: 0 },
      { mes: "2026-02", cobradoCapital: 150, cobradoInteres: 0, esperadoCapital: 100, esperadoInteres: 0 },
    ]);
    expect(c.meses.map((m) => m.cumplimiento)).toEqual([null, 150]);
  });

  it("proyección de los 6 meses siguientes: 78,3 M", () => {
    const P: [string, number, number][] = [["2026-12", 9.8, 5.9], ["2027-01", 9.4, 5.6], ["2027-02", 8.9, 5.2], ["2027-03", 8.1, 4.7], ["2027-04", 7.2, 4.1], ["2027-05", 6.0, 3.4]];
    const cuotas = P.flatMap(([mes, c, i]) => [
      { fechaProgramada: `${mes}-05`, capital: M(c) / 2, interes: M(i) / 2 },
      { fechaProgramada: `${mes}-20`, capital: M(c) / 2, interes: M(i) / 2 },
    ]);
    // Outside the window: overdue (Oct), current month (Nov) and too far (Jun 2027).
    cuotas.push({ fechaProgramada: "2026-10-10", capital: 1, interes: 1 }, { fechaProgramada: "2026-11-30", capital: 1, interes: 1 }, { fechaProgramada: "2027-06-01", capital: 1, interes: 1 });
    const p = proyectarCobros(cuotas, "2026-11");
    expect(p.meses.map((m) => m.mes)).toEqual(P.map((x) => x[0]));
    expect(p.meses[0].total).toBe(15_700_000);
    expect(p.total).toBe(78_300_000);
    // The canvas KPI says 28,3 M but its own bars add up to 28,9 M.
    expect(p.intereses).toBe(28_900_000);
  });

  it("meses vacíos de la ventana aparecen en cero", () => {
    const p = proyectarCobros([], "2026-11", 3);
    expect(p.meses).toEqual([
      { mes: "2026-12", capital: 0, interes: 0, total: 0 },
      { mes: "2027-01", capital: 0, interes: 0, total: 0 },
      { mes: "2027-02", capital: 0, interes: 0, total: 0 },
    ]);
  });
});

describe("tramos de atraso", () => {
  const HOY = "2026-11-25";
  const conAtraso = (dias: number, saldo: number, id: string): CreditoCarteraInput => {
    const d = new Date(Date.UTC(2026, 10, 25 - dias));
    const vencida = dias > 0 ? d.toISOString().slice(0, 10) : null;
    return { creditoId: id, saldoCapital: saldo, cuotaVencidaMasAntigua: vencida, ultimoPago: null, primeraCuota: null };
  };

  it("lienzo: 31 al día · 151,2 M … 3 de más de 90 · 8,4 M; suman lo que está en la calle", () => {
    const grupos: [number, number, number][] = [[0, 151.2, 31], [15, 18.6, 5], [45, 5.1, 2], [75, 3.1, 1], [120, 8.4, 3]];
    const creditos = grupos.flatMap(([dias, total, n], g) => repartir(M(total), n).map((s, i) => conAtraso(dias, s, `${g}-${i}`)));
    const t = calcularTramosAtraso(creditos, HOY);
    expect(t.map((x) => [x.id, x.creditos, x.saldo])).toEqual([
      ["AL_DIA", 31, 151_200_000], ["D1_30", 5, 18_600_000], ["D31_60", 2, 5_100_000], ["D61_90", 1, 3_100_000], ["MAS_90", 3, 8_400_000],
    ]);
    expect(t.reduce((s, x) => s + x.saldo, 0)).toBe(186_400_000);
    expect(t.reduce((s, x) => s + x.creditos, 0)).toBe(42);
  });

  it("bordes de tramo: 0, 1, 30, 31, 60, 61, 90, 91", () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(tramoDe)).toEqual(["AL_DIA", "D1_30", "D1_30", "D31_60", "D31_60", "D61_90", "D61_90", "MAS_90"]);
  });

  it("una cuota que vence hoy no es atraso; créditos sin saldo no entran", () => {
    expect(diasAtraso({ cuotaVencidaMasAntigua: HOY }, HOY)).toBe(0);
    expect(diasAtraso({ cuotaVencidaMasAntigua: "2026-11-24" }, HOY)).toBe(1);
    const t = calcularTramosAtraso([conAtraso(0, 0, "x")], HOY);
    expect(t.every((x) => x.creditos === 0)).toBe(true);
  });

  it("días sin pagos: desde el último pago, o desde la primera cuota si nunca pagó", () => {
    expect(diasSinPagos({ ultimoPago: "2026-08-27", primeraCuota: "2026-01-01" }, HOY)).toBe(90);
    expect(diasSinPagos({ ultimoPago: null, primeraCuota: "2026-11-01" }, HOY)).toBe(24);
    expect(diasSinPagos({ ultimoPago: null, primeraCuota: "2026-12-01" }, HOY)).toBe(0);
    expect(diasSinPagos({ ultimoPago: null, primeraCuota: null }, HOY)).toBe(0);
  });
});
