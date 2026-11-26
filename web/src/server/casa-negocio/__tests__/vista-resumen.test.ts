/**
 * Resumen view model: figures, edge cases and — the reason this tab exists —
 * parity with Reportes («Evolución y proyección»).
 *
 * PARITY. `reportesHistorico` / `reportesProyeccion` below transcribe, line
 * by line, the SQL of `getHistoricoRecaudacion` and `getProyeccionCartera`
 * (src/features/analytics/queries.ts): same estados, same CASE, same
 * `capitalProgramado - capitalPagado`, grouped by the month of the stored
 * instant (UTC, as Postgres' DATE_TRUNC sees a `timestamp`). The fixture rows
 * go through both and every month must agree to the cent.
 */
import { describe, expect, it } from "vitest";

import type { TramoCartera } from "@/features/casa-negocio/types";

import {
  construirVistaResumen,
  type DatosResumen,
  type FilaCobro,
  type FilaPendiente,
  type FilaProgramada,
  MESES_PROYECCION,
} from "../vista-resumen";

/** Bogota midnight, as the app stores days. */
const dia = (d: string) => new Date(`${d}T05:00:00.000Z`);

// ---------------------------------------------------------------------------
// Reportes, transcribed
// ---------------------------------------------------------------------------

interface EventoReportes {
  tipo: "CUOTA_PROGRAMADA" | "ABONO_CAPITAL";
  estado: "PAGADO" | "CANCELADO_POR_ABONO" | "PENDIENTE" | "ATRASADO" | "MORA";
  fechaPago: Date | null;
  fechaProgramada: Date;
  montoPagado: number;
  capitalPagado: number;
  interesPagado: number;
  capitalProgramado: number;
  interesProgramado: number;
}

const mesUTC = (d: Date) => d.toISOString().slice(0, 7);
const cents = (n: number) => Math.round(n * 100);

/** `getHistoricoRecaudacion`, in cents per month. */
function reportesHistorico(eventos: EventoReportes[]) {
  const out = new Map<string, { capital: number; interes: number }>();
  for (const e of eventos) {
    if (!(e.estado === "PAGADO" || e.estado === "CANCELADO_POR_ABONO") || e.fechaPago === null) continue;
    const split = e.capitalPagado > 0 || e.interesPagado > 0;
    const capital = split ? e.capitalPagado : e.tipo === "ABONO_CAPITAL" ? e.montoPagado : e.capitalProgramado;
    const interes = split ? e.interesPagado : e.tipo === "ABONO_CAPITAL" ? 0 : e.interesProgramado;
    const acc = out.get(mesUTC(e.fechaPago)) ?? { capital: 0, interes: 0 };
    acc.capital += cents(capital);
    acc.interes += cents(interes);
    out.set(mesUTC(e.fechaPago), acc);
  }
  return out;
}

/** `getProyeccionCartera`, in cents per month. */
function reportesProyeccion(eventos: EventoReportes[]) {
  const out = new Map<string, { capital: number; interes: number }>();
  for (const e of eventos) {
    if (!["PENDIENTE", "ATRASADO", "MORA"].includes(e.estado)) continue;
    const acc = out.get(mesUTC(e.fechaProgramada)) ?? { capital: 0, interes: 0 };
    acc.capital += cents(e.capitalProgramado) - cents(e.capitalPagado);
    acc.interes += cents(e.interesProgramado) - cents(e.interesPagado);
    out.set(mesUTC(e.fechaProgramada), acc);
  }
  return out;
}

/** What the loader's three queries return for the same rows. */
function filasDe(eventos: EventoReportes[], hoy: string) {
  const finActual = new Date(`${hoy.slice(0, 7)}-01T05:00:00.000Z`);
  finActual.setUTCMonth(finActual.getUTCMonth() + 1);
  const cobros: FilaCobro[] = eventos
    .filter((e) => (e.estado === "PAGADO" || e.estado === "CANCELADO_POR_ABONO") && e.fechaPago && e.fechaPago < finActual)
    .map((e) => ({ ...e, fechaPago: e.fechaPago! }));
  const programadas: FilaProgramada[] = eventos.filter(
    (e) => e.tipo === "CUOTA_PROGRAMADA" && e.estado !== "CANCELADO_POR_ABONO" && e.fechaProgramada < finActual,
  );
  const pendientes: FilaPendiente[] = eventos.filter(
    (e) => ["PENDIENTE", "ATRASADO", "MORA"].includes(e.estado) && e.fechaProgramada >= finActual,
  );
  return { cobros, programadas, pendientes };
}

// ---------------------------------------------------------------------------
// Fixture: two loans, fourteen months of history, odd cents on purpose
// ---------------------------------------------------------------------------

const HOY = "2026-11-25";

function cuota(fechaProgramada: string, capital: number, interes: number, extra: Partial<EventoReportes> = {}): EventoReportes {
  return {
    tipo: "CUOTA_PROGRAMADA",
    estado: "PENDIENTE",
    fechaPago: null,
    fechaProgramada: dia(fechaProgramada),
    montoPagado: 0,
    capitalPagado: 0,
    interesPagado: 0,
    capitalProgramado: capital,
    interesProgramado: interes,
    ...extra,
  };
}

function pagada(fecha: string, capital: number, interes: number, pagoEl = fecha): EventoReportes {
  return cuota(fecha, capital, interes, {
    estado: "PAGADO",
    fechaPago: dia(pagoEl),
    montoPagado: capital + interes,
    capitalPagado: capital,
    interesPagado: interes,
  });
}

function eventosFixture(): EventoReportes[] {
  const ev: EventoReportes[] = [];
  // Loan A: monthly since 2025-09, 1.000.000,10 capital + 333.333,33 interest.
  for (let i = 0; i < 15; i += 1) {
    const d = new Date(Date.UTC(2025, 8 + i, 10));
    const f = d.toISOString().slice(0, 10);
    if (f < "2026-11-01") ev.push(pagada(f, 1_000_000.1, 333_333.33));
    else ev.push(cuota(f, 1_000_000.1, 333_333.33));
  }
  // Loan B: legacy payments without split (capitalPagado = interesPagado = 0).
  ev.push(
    cuota("2026-03-15", 500_000, 150_000, { estado: "PAGADO", fechaPago: dia("2026-03-20"), montoPagado: 650_000 }),
    // Paid late, in the next month: counts where the money came in.
    cuota("2026-05-15", 500_000, 150_000, { estado: "PAGADO", fechaPago: dia("2026-06-02"), montoPagado: 650_000 }),
    // Overdue and unpaid: tocaba cobrar in July, nothing came in.
    cuota("2026-07-15", 500_000, 150_000, { estado: "MORA" }),
    // Partially paid future cuota: Reportes projects only what is left.
    cuota("2026-12-15", 500_000, 150_000, { estado: "PENDIENTE", capitalPagado: 100_000.55, interesPagado: 20_000 }),
    cuota("2027-04-15", 500_000, 150_000),
    // Beyond the six months: neither tab projects it in «viene en 6 meses».
    cuota("2027-06-15", 500_000, 150_000),
  );
  // An abono to capital and the cuota it cancelled (all zeros, no fechaPago).
  ev.push({
    tipo: "ABONO_CAPITAL",
    estado: "PAGADO",
    fechaPago: dia("2026-08-05"),
    fechaProgramada: dia("2026-08-05"),
    montoPagado: 2_000_000,
    capitalPagado: 0,
    interesPagado: 0,
    capitalProgramado: 0,
    interesProgramado: 0,
  });
  ev.push(cuota("2026-09-15", 0, 0, { estado: "CANCELADO_POR_ABONO" }));
  return ev;
}

const TRAMOS_VACIOS: TramoCartera[] = (["AL_DIA", "1_30", "31_60", "61_90", "MAS_90"] as const).map((tramo) => ({
  tramo,
  creditos: 0,
  saldoCapital: 0,
  montoVencido: 0,
}));

function datos(extra: Partial<DatosResumen> = {}, eventos = eventosFixture()): DatosResumen {
  return {
    hoy: HOY,
    inicioModulo: null,
    rango: 12,
    ...filasDe(eventos, HOY),
    movimientos: [],
    castigos: [],
    ahorroFinMes: {},
    tramos: TRAMOS_VACIOS,
    ...extra,
  };
}

// ---------------------------------------------------------------------------

describe("paridad con Reportes", () => {
  const eventos = eventosFixture();
  const vista = construirVistaResumen(datos({}, eventos));
  const historico = reportesHistorico(eventos);
  const proyeccion = reportesProyeccion(eventos);

  it("cada mes cobrado coincide al centavo con getHistoricoRecaudacion", () => {
    const historia = vista.cobros.meses.filter((m) => !m.proyectado);
    expect(historia).toHaveLength(12);
    for (const m of historia) {
      const r = historico.get(m.mes) ?? { capital: 0, interes: 0 };
      expect([cents(m.capital), cents(m.interes)], m.mes).toEqual([r.capital, r.interes]);
      expect(cents(m.total)).toBe(r.capital + r.interes);
    }
  });

  it("el total de 12 meses es la suma de esos meses en Reportes", () => {
    const meses = vista.cobros.meses.filter((m) => !m.proyectado).map((m) => m.mes);
    const reportes = meses.reduce((s, mes) => s + (historico.get(mes)?.capital ?? 0) + (historico.get(mes)?.interes ?? 0), 0);
    expect(cents(vista.cobros.cobrado)).toBe(reportes);
    // Window Dec-2025..Nov-2026: 11 cuotas of A (Dec..Oct) + the abono + B's March and June payments.
    expect(vista.cobros.cobrado).toBeCloseTo(11 * 1_333_333.43 + 2_000_000 + 650_000 * 2, 2);
  });

  it("cada mes proyectado coincide con getProyeccionCartera, y «viene» suma los seis", () => {
    const futuros = vista.cobros.meses.filter((m) => m.proyectado);
    expect(futuros.map((m) => m.mes)).toEqual(["2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05"]);
    let total = 0;
    let intereses = 0;
    for (const m of futuros) {
      const r = proyeccion.get(m.mes) ?? { capital: 0, interes: 0 };
      expect([cents(m.capital), cents(m.interes)], m.mes).toEqual([r.capital, r.interes]);
      total += r.capital + r.interes;
      intereses += r.interes;
    }
    expect(cents(vista.cobros.viene)).toBe(total);
    expect(cents(vista.cobros.vieneIntereses)).toBe(intereses);
  });

  it("Reportes también proyecta lo vencido y lo lejano; el Resumen no lo cuenta en «viene»", () => {
    expect(proyeccion.has("2026-07")).toBe(true); // the overdue cuota, shown by the tramos instead
    expect(proyeccion.has("2027-06")).toBe(true);
    expect(vista.cobros.meses.some((m) => m.mes === "2027-06")).toBe(false);
  });
});

describe("cobros", () => {
  const vista = construirVistaResumen(datos());

  it("marca lo que tocaba cobrar y el cumplimiento de cada mes pasado", () => {
    const julio = vista.cobros.meses.find((m) => m.mes === "2026-07")!;
    expect(julio.esperado).toBeCloseTo(1_333_333.43 + 650_000, 2);
    expect(julio.cumplimiento).toBe(Math.floor((1_333_333.43 * 100) / (1_333_333.43 + 650_000)));
    // June collected B's late May cuota: above 100 %.
    expect(vista.cobros.meses.find((m) => m.mes === "2026-06")!.cumplimiento).toBeGreaterThan(100);
    expect(vista.cobros.meses.filter((m) => m.proyectado).every((m) => m.esperado === null)).toBe(true);
  });

  it("HOY va entre el mes actual y el primero proyectado", () => {
    expect(vista.cobros.indiceHoy).toBe(12);
    expect(vista.cobros.meses[11].mes).toBe("2026-11");
    expect(vista.cobros.meses).toHaveLength(12 + MESES_PROYECCION);
  });

  it("deja una lectura en texto con las tres cifras", () => {
    expect(vista.cobros.lectura).toMatch(/^Cobros mensuales de diciembre 2025 a noviembre 2026/);
    expect(vista.cobros.lectura).toContain("% de lo que tocaba cobrar");
    expect(vista.cobros.lectura).toContain("son intereses");
  });
});

describe("ganancia y retiros", () => {
  const movimientos = [
    { mes: "2026-10", tipo: "RETIRO_CASA" as const, monto: 500_000, tipoOrigen: "BANCO" as const, tipoDestino: "BANCO" as const },
    { mes: "2026-11", tipo: "RETIRO_CASA" as const, monto: 100_000, tipoOrigen: "BANCO" as const, tipoDestino: "BANCO" as const },
    { mes: "2026-11", tipo: "GASTO_NEGOCIO" as const, monto: 50_000, tipoOrigen: "BANCO" as const, tipoDestino: null },
    { mes: "2026-09", tipo: "RETIRO_CASA" as const, monto: 400_000, tipoOrigen: "BANCO" as const, tipoDestino: "BANCO" as const },
  ];

  it("antes del módulo los retiros son null y nunca bajan el capital", () => {
    const vista = construirVistaResumen(datos({ inicioModulo: "2026-10-01", movimientos }));
    const sept = vista.ganancia.meses.find((m) => m.mes === "2026-09")!;
    expect(sept).toMatchObject({ retiros: null, reinvertido: null, capitalBajo: false, anotado: false });
    expect(sept.ganancia).toBeCloseTo(333_333.33, 2);
    expect(vista.ganancia.lectura).toContain("los retiros no se anotaban");
  });

  it("marca los meses en que se llevó más de lo ganado y suma lo que bajó", () => {
    const vista = construirVistaResumen(datos({ inicioModulo: "2026-09-01", movimientos }));
    // Sept: 333.333,33 − 400.000; Oct: 333.333,33 − 500.000; Nov: no interest yet − 50.000 − 100.000.
    expect(vista.ganancia.mesesCapitalBajo).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(vista.ganancia.capitalPerdido).toBeCloseTo(66_666.67 + 166_666.67 + 150_000, 2);
    expect(vista.ganancia.aviso).toBe(
      "En septiembre, octubre y noviembre se llevó a la casa más de lo que ganó el negocio: el capital bajó $ 383.333.",
    );
  });

  it("sin meses negativos no hay aviso", () => {
    const vista = construirVistaResumen(datos({ inicioModulo: "2026-09-01" }));
    expect(vista.ganancia.aviso).toBeNull();
    expect(vista.ganancia.lectura).toContain("Ningún mes");
  });
});

describe("historia corta", () => {
  it("recorta los meses vacíos del principio", () => {
    const eventos = [pagada("2026-09-10", 1_000_000, 300_000), cuota("2026-12-10", 1_000_000, 300_000)];
    const vista = construirVistaResumen(datos({}, eventos));
    expect(vista.ganancia.meses.map((m) => m.mes)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(vista.cobros.indiceHoy).toBe(3);
    expect(vista.cobros.lectura).toMatch(/^Cobros mensuales de septiembre 2026/);
    expect(vista.tarjetas.map((t) => t.mes)).toEqual(["2026-11", "2026-10", "2026-09"]);
  });

  it("sin nada, devuelve listas vacías y la proyección en ceros", () => {
    const vista = construirVistaResumen(datos({}, []));
    expect(vista.ganancia.meses).toEqual([]);
    expect(vista.cobros.indiceHoy).toBe(0);
    expect(vista.cobros.meses.every((m) => m.proyectado && m.total === 0)).toBe(true);
    expect(vista.cobros.cumplimiento).toBeNull();
    expect(vista.tarjetas).toEqual([]);
  });

  it("el módulo recién estrenado cuenta como actividad aunque no haya cobros", () => {
    const vista = construirVistaResumen(datos({ inicioModulo: "2026-11-01" }, []));
    expect(vista.tarjetas.map((t) => t.mes)).toEqual(["2026-11"]);
  });
});

describe("mes a mes", () => {
  const movimientos = [
    { mes: "2026-11", tipo: "RETIRO_CASA" as const, monto: 5_500_000, tipoOrigen: "BANCO" as const, tipoDestino: "BANCO" as const },
    { mes: "2026-11", tipo: "INGRESO_CASA" as const, monto: 200_000, tipoOrigen: null, tipoDestino: "BANCO" as const },
    { mes: "2026-11", tipo: "GASTO_FIJO" as const, monto: 2_727_000, tipoOrigen: "BANCO" as const, tipoDestino: null },
    { mes: "2026-11", tipo: "GASTO_VARIABLE" as const, monto: 1_940_000, tipoOrigen: "EFECTIVO" as const, tipoDestino: null },
  ];

  it("el mes actual va primero y en tinta; los meses sin anotar quedan en blanco", () => {
    const vista = construirVistaResumen(
      datos({ inicioModulo: "2026-11-01", movimientos, ahorroFinMes: { "2026-11": 7_000_000, "2026-10": 1_000 } }),
    );
    const [nov, oct] = vista.tarjetas;
    expect(nov).toMatchObject({ mes: "2026-11", actual: true, retiros: 5_500_000, casaSobro: 1_033_000, ahorro: 7_000_000 });
    expect(nov.reinvertido).toBe(-5_500_000);
    expect(oct).toMatchObject({ actual: false, retiros: null, casaSobro: null, ahorro: null });
    expect(vista.tarjetas.filter((t) => t.actual)).toHaveLength(1);
  });

  it("24 meses alarga las tarjetas, no las gráficas", () => {
    const vista = construirVistaResumen(datos({ rango: 24 }));
    expect(vista.tarjetas).toHaveLength(15); // the fixture starts in Sept 2025
    expect(vista.tarjetas.at(-1)!.mes).toBe("2025-09");
    expect(vista.ganancia.meses).toHaveLength(12);
    expect(vista.cobros.indiceHoy).toBe(12);
  });
});

describe("cartera", () => {
  it("lleva los tramos con su etiqueta y suma «en la calle»", () => {
    const tramos: TramoCartera[] = [
      { tramo: "AL_DIA", creditos: 31, saldoCapital: 151_200_000.5, montoVencido: 0 },
      { tramo: "1_30", creditos: 5, saldoCapital: 18_600_000.25, montoVencido: 900_000 },
      { tramo: "31_60", creditos: 0, saldoCapital: 0, montoVencido: 0 },
      { tramo: "61_90", creditos: 1, saldoCapital: 3_100_000, montoVencido: 600_000 },
      { tramo: "MAS_90", creditos: 3, saldoCapital: 8_400_000, montoVencido: 3_000_000 },
    ];
    const vista = construirVistaResumen(datos({ tramos }));
    expect(vista.cartera.tramos.map((t) => t.label)).toEqual(["Al día", "1 a 30 días", "31 a 60 días", "61 a 90 días", "Más de 90 días"]);
    expect(vista.cartera.enLaCalle).toBe(181_300_000.75);
    expect(vista.cartera.creditos).toBe(40);
    expect(vista.cartera.lectura).toContain("más de 90 días, $ 8,4 M en 3 créditos");
    expect(vista.cartera.lectura).not.toContain("31 a 60");
  });
});
