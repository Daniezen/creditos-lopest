/**
 * View models of the Casa and Negocio tabs, from a plain month read (no
 * database): equations, book grouping, fijos/sobres with their avisos,
 * running balance walked back from the account cards, «sin cuenta» rows and
 * read-only mode.
 */
import { describe, expect, it } from "vitest";

import type { CasaNegocioMes, CategoriaMes, CuentaMes, MovimientoManual } from "@/features/casa-negocio/types";

import { construirVistaCasa, fechaPorDefecto, mesesVecinos } from "../vista-casa";
import { TODAS, construirVistaNegocio } from "../vista-negocio";

const V = "2026-12-01T12:00:00.000Z";

function cuenta(id: string, nombre: string, grupo: CuentaMes["grupo"], saldoFinMes: number, extra: Partial<CuentaMes> = {}): CuentaMes {
  return {
    id, nombre, grupo, tipo: "BANCO", orden: 0, archivada: false,
    saldoInicial: 0, fechaSaldoInicial: "2026-12-01",
    saldoInicioMes: 0, entradasMes: 0, salidasMes: 0,
    saldoFinMes, saldoActual: saldoFinMes, ultimoArqueo: null, version: V, ...extra,
  };
}

function categoria(id: string, nombre: string, clase: CategoriaMes["clase"], monto: number | null, extra: Partial<CategoriaMes> = {}): CategoriaMes {
  return {
    id, nombre, clase, monto, periodicidad: "MENSUAL", mesAnual: null, diaPago: null, activa: true, orden: 0,
    gastadoMes: 0, movimientosMes: 0, venceEnMes: true, fechaPagoMes: null, pagadoMes: false, proximoVencimiento: null,
    version: V, ...extra,
  };
}

let n = 0;
function mov(tipo: MovimientoManual["tipo"], fecha: string, monto: number, extra: Partial<MovimientoManual> = {}): MovimientoManual {
  n += 1;
  return {
    id: `m${n}`, tipo, fecha, monto, cuentaOrigenId: null, cuentaDestinoId: null, categoriaId: null, nota: null,
    accionPor: null, creadoEn: `2026-12-${fecha.slice(8, 10)}T15:00:0${n % 10}.000Z`, version: V, ...extra,
  };
}

function mes(extra: Partial<CasaNegocioMes> = {}): CasaNegocioMes {
  return {
    mes: "2026-12",
    hoy: "2026-12-20",
    inicioModulo: "2026-12-01",
    usuario: { id: "u1", nombre: "Padre", capacidades: ["VER", "ANOTAR"] },
    cuentas: [
      cuenta("banco", "Bancolombia", "NEGOCIO", 10_000_000),
      cuenta("efectivo", "Efectivo", "NEGOCIO", 1_000_000),
      cuenta("casa", "Cuenta casa", "CASA", 2_000_000),
    ],
    movimientos: [
      mov("RETIRO_CASA", "2026-12-01", 3_000_000, { cuentaOrigenId: "banco", cuentaDestinoId: "casa" }),
      mov("GASTO_FIJO", "2026-12-05", 1_787_000, { cuentaOrigenId: "casa", categoriaId: "arriendo" }),
      mov("GASTO_VARIABLE", "2026-12-05", 186_000, { cuentaOrigenId: "casa", categoriaId: "gasolina", nota: "Tanqueo" }),
      mov("INGRESO_CASA", "2026-12-08", 400_000, { cuentaDestinoId: "casa", nota: "Regalo" }),
      mov("GASTO_NEGOCIO", "2026-12-10", 45_000, { cuentaOrigenId: "efectivo", nota: "Papelería" }),
      mov("TRASLADO", "2026-12-12", 500_000, { cuentaOrigenId: "efectivo", cuentaDestinoId: "banco" }),
    ],
    cobros: [
      {
        eventoFinancieroId: "ev1", creditoId: "c1", creditoCodigo: "LP-1", clienteNombre: "Ana", dueno: { id: "u1", nombre: "Padre" }, esPropio: true,
        tipo: "CUOTA", numeroCuota: 4, fechaPago: "2026-12-11", capital: 380_000, interes: 95_000, total: 475_000,
        cuentaId: "banco", asignacionVersion: V, asignable: true,
      },
      {
        eventoFinancieroId: "ev2", creditoId: "c2", creditoCodigo: "LP-2", clienteNombre: "Beto", dueno: { id: "u2", nombre: "María" }, esPropio: false,
        tipo: "CUOTA", numeroCuota: 9, fechaPago: "2026-12-15", capital: 500_000, interes: 120_000, total: 620_000,
        cuentaId: null, asignacionVersion: null, asignable: true,
      },
    ],
    desembolsos: [
      {
        creditoId: "c3", creditoCodigo: "LP-3", clienteNombre: "Caro", dueno: { id: "u1", nombre: "Padre" }, esPropio: true,
        fecha: "2026-12-14", monto: 3_000_000, cuentaId: null, asignacionVersion: null, asignable: true,
      },
    ],
    sinCuenta: { cobros: [], desembolsos: [] },
    cuotasPorCobrar: [],
    tocabaCobrar: { cuotas: 0, pagadas: 0, programado: 0, capitalProgramado: 0, interesProgramado: 0, cobradoDeLoProgramado: 0 },
    proyeccion: [],
    cartera: { enLaCalle: 0, creditosActivos: 0, tramos: [], creditos: [] },
    categorias: [
      categoria("arriendo", "Arriendo", "FIJO", 1_787_000, { diaPago: 5 }),
      categoria("seguros", "Seguros Bolo", "FIJO", 170_000, { diaPago: 15 }),
      categoria("internet", "Internet y TV", "FIJO", 120_000, { diaPago: 28 }),
      categoria("soat", "SOAT Bolo", "FIJO", 660_000, { periodicidad: "ANUAL", mesAnual: 8, diaPago: 10 }),
      categoria("gasolina", "Gasolina", "VARIABLE", 200_000),
      categoria("mercado", "Mercado", "VARIABLE", 2_700_000),
    ],
    castigos: [],
    arqueos: [
      { id: "a1", fecha: "2026-12-18T20:00:00.000Z", accionPor: null, nota: null, detalles: [{ cuentaId: "efectivo", saldoSistema: 1_000_000, contado: 950_000, diferencia: -50_000 }] },
    ],
    historial: [],
    configuracion: { metaAsignacionCasa: null, metaAhorro: null, cuentaAhorroId: null, version: V, reglas: [] },
    permisos: null,
    ...extra,
  };
}

describe("construirVistaCasa", () => {
  const vista = construirVistaCasa(mes());

  it("computes the casa equation: entró − fijos − variables = hoy", () => {
    expect(vista.ecuacion).toEqual({ entro: 3_400_000, fijos: 1_787_000, variables: 186_000, hoy: 1_427_000 });
  });

  it("groups the book by day, newest first, with the business retiro appearing on its own", () => {
    expect(vista.libro.map((d) => d.fecha)).toEqual(["2026-12-08", "2026-12-05", "2026-12-01"]);
    expect(vista.libro[2]).toMatchObject({ dia: 1, semana: "mar" });
    const retiro = vista.libro[2].filas[0];
    expect(retiro).toMatchObject({ clase: "retiro", nombre: "Retiro del negocio", detalle: "Bancolombia → Cuenta casa", monto: 3_000_000, editable: null });
    expect(vista.libro[1].filas.map((f) => f.nombre).sort()).toEqual(["Arriendo", "Gasolina"]);
    expect(vista.libro[0].filas[0]).toMatchObject({ clase: "ingreso", nombre: "Regalo", monto: 400_000 });
    expect(vista.libro[0].filas[0].editable?.version).toBe(V);
  });

  it("leaves business-only movements out of the household book", () => {
    const nombres = vista.libro.flatMap((d) => d.filas.map((f) => f.nombre));
    expect(nombres).not.toContain("Gasto del negocio");
    expect(nombres).not.toContain("Traslado");
  });

  it("lists fijos as paid, overdue (with the aviso beside it), upcoming and not this month", () => {
    expect(vista.fijos.map((f) => [f.nombre, f.estado, f.detalle])).toEqual([
      ["Arriendo", "pagado", "Pagado el 5"],
      ["Seguros Bolo", "vencido", "Venció el 15"],
      ["Internet y TV", "porVenir", "Vence el 28"],
      ["SOAT Bolo", "noToca", "En agosto"],
    ]);
    expect(vista.fijos[1].avisos).toEqual([{ nivel: "problema", texto: "Seguros Bolo sin pagar desde el 15 · $ 170.000" }]);
    expect(vista.fijos[0].avisos).toEqual([]);
  });

  it("offers the unpaid fijos as chips, overdue first by due day", () => {
    expect(vista.formulario.pendientes).toEqual([
      { categoriaId: "seguros", nombre: "Seguros Bolo", pendiente: 170_000, vencido: true },
      { categoriaId: "internet", nombre: "Internet y TV", pendiente: 120_000, vencido: false },
    ]);
  });

  it("raises the envelope aviso near the cap and words the select options", () => {
    const gasolina = vista.sobres.find((s) => s.id === "gasolina")!;
    expect(gasolina).toMatchObject({ nivel: "CERCA", queda: 14_000, ancho: 93 });
    expect(gasolina.avisos[0]).toMatchObject({ nivel: "atencion" });
    expect(vista.sobres.find((s) => s.id === "mercado")!.avisos).toEqual([]);
    expect(vista.formulario.sobres.map((o) => o.etiqueta)).toEqual(["Gasolina · quedan $ 14.000", "Mercado · quedan $ 2.700.000"]);
  });

  it("honours a rule switched off in Configuración", () => {
    const apagada = construirVistaCasa(
      mes({ configuracion: { metaAsignacionCasa: null, metaAhorro: null, cuentaAhorroId: null, version: V, reglas: [{ codigo: "FIJO_VENCIDO_SIN_PAGAR", activa: false, umbral: null, version: V }] } }),
    );
    expect(apagada.fijos.find((f) => f.id === "seguros")!.avisos).toEqual([]);
  });

  it("is read-only without ANOTAR and flags the missing household account", () => {
    const lectura = construirVistaCasa(mes({ usuario: { id: "u3", nombre: "Madre", capacidades: ["VER"] } }));
    expect(lectura.puedeAnotar).toBe(false);
    const sinCuentas = construirVistaCasa(mes({ cuentas: [cuenta("banco", "Bancolombia", "NEGOCIO", 0)], movimientos: [] }));
    expect(sinCuentas.sinCuentas).toBe(true);
    expect(sinCuentas.libro).toEqual([]);
  });
});

describe("construirVistaNegocio", () => {
  const vista = construirVistaNegocio(mes());

  it("computes the business equation from interest collected", () => {
    expect(vista.ecuacion).toEqual({ intereses: 215_000, gastos: 45_000, perdidos: 0, ganancia: 170_000, aCasa: 3_000_000, reinvertido: -2_830_000 });
  });

  it("mixes automatic and manual rows, newest first", () => {
    expect(vista.libro.map((f) => [f.dia, f.origen, f.tipo])).toEqual([
      [15, "auto", "Cuota 9"],
      [14, "auto", "Préstamo entregado"],
      [12, "manual", "Traslado"],
      [11, "auto", "Cuota 4"],
      [10, "manual", "Gasto del negocio"],
      [1, "manual", "Retiro a la casa"],
    ]);
  });

  it("walks the running balance back from the month-end balances", () => {
    const saldo = Object.fromEntries(vista.libro.map((f) => [f.key, f.saldo]));
    // Rows without account move nothing and show no balance.
    expect(saldo["cobro:ev2"]).toBeNull();
    expect(saldo["desembolso:c3"]).toBeNull();
    const [, , traslado, cuota, gasto, retiro] = vista.libro;
    expect(traslado.saldo).toBe(11_000_000);
    expect(traslado).toMatchObject({ efecto: 0, montoNeutral: 500_000, efectoPorCuenta: { efectivo: -500_000, banco: 500_000 } });
    expect(cuota.saldo).toBe(11_000_000);
    expect(gasto.saldo).toBe(10_525_000);
    expect(retiro.saldo).toBe(10_570_000);
    // Per account: Bancolombia ends at 10 M, so before the traslado it had 9,5 M.
    expect(traslado.saldoPorCuenta).toEqual({ efectivo: 1_000_000, banco: 10_000_000 });
    expect(cuota.saldoPorCuenta).toEqual({ banco: 9_500_000 });
    expect(retiro.saldoPorCuenta).toEqual({ banco: 9_025_000 });
  });

  it("asks where an unassigned cobro entered and where a disbursement came from, and marks others' loans", () => {
    const cobro = vista.libro.find((f) => f.key === "cobro:ev2")!;
    expect(cobro.asignacion).toEqual({ clase: "cobro", eventoFinancieroId: "ev2", creditoId: null, version: null, pregunta: "¿Dónde entró?" });
    expect(cobro.dueno).toBe("de María");
    expect(cobro.cuentaTexto).toBe("Sin cuenta");
    const desembolso = vista.libro.find((f) => f.key === "desembolso:c3")!;
    expect(desembolso.asignacion?.pregunta).toBe("¿De dónde salió?");
    expect(vista.libro.find((f) => f.key === "cobro:ev1")!.asignacion).toBeNull();
  });

  it("shows the accounts as filters with their counting status", () => {
    expect(vista.filtros.map((f) => [f.id, f.saldo, f.detalle, f.tono])).toEqual([
      [TODAS, 11_000_000, "2 cuentas", "neutral"],
      ["banco", 10_000_000, "Sin contar hace 19 días", "atencion"],
      ["efectivo", 1_000_000, "Faltan $ 50.000", "problema"],
    ]);
  });

  it("lists every pending assignment of any month, oldest first", () => {
    const datos = mes();
    const pendientes = construirVistaNegocio({
      ...datos,
      sinCuenta: { cobros: [datos.cobros[1]], desembolsos: [datos.desembolsos[0]] },
    }).sinCuenta;
    expect(pendientes.map((p) => [p.key, p.signo])).toEqual([
      ["desembolso:c3", -1],
      ["cobro:ev2", 1],
    ]);
  });

  it("flags a month without business accounts", () => {
    const sin = construirVistaNegocio(mes({ cuentas: [cuenta("casa", "Cuenta casa", "CASA", 0)] }));
    expect(sin.sinCuentas).toBe(true);
    expect(sin.filtros).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("defaults the form date to today, or the last day of a past month", () => {
    expect(fechaPorDefecto("2026-12", "2026-12-20")).toBe("2026-12-20");
    expect(fechaPorDefecto("2026-11", "2026-12-20")).toBe("2026-11-30");
  });

  it("never offers a month after the current one", () => {
    expect(mesesVecinos("2026-12", "2026-12-20")).toEqual({ anterior: "2026-11", siguiente: null });
    expect(mesesVecinos("2026-10", "2026-12-20")).toEqual({ anterior: "2026-09", siguiente: "2026-11" });
  });
});
