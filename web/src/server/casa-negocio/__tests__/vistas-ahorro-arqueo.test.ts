/**
 * View models of the Ahorro and Arqueo tabs: pure functions over the month
 * read, checked against the canvas numbers (Ahorro.dc.html, Arqueo.dc.html).
 */
import { describe, expect, it } from "vitest";

import {
  claveCierre,
  construirVistaAhorro,
  mesDeClaveCierre,
  prefijoCierre,
  sobranteCasa,
  textoBarra,
  type CierreAhorroRegistro,
} from "../vista-ahorro";
import { construirVistaArqueo, diaCorto, leerContado } from "../vista-arqueo";
import { cuenta, historial, mesFixture, movimiento, reglas } from "./mes-fixture";

/** November of the canvas: 6,5 M came in, 5,869 M spent, 0 fijos owed → 631.000 left. */
const movimientosNoviembre = [
  movimiento("r1", "RETIRO_CASA", 3_000_000, "2026-11-01"),
  movimiento("r2", "RETIRO_CASA", 3_500_000, "2026-11-24"),
  movimiento("f1", "GASTO_FIJO", 2_727_000),
  movimiento("v1", "GASTO_VARIABLE", 3_142_000),
];

function listo(v: ReturnType<typeof construirVistaAhorro>) {
  if (v.estado !== "LISTO") throw new Error(`expected LISTO, got ${v.estado}`);
  return v;
}

describe("vista Ahorro", () => {
  it("without a savings account chosen, is the empty state that leads to Configuración", () => {
    const sinCuenta = mesFixture({ configuracion: { ...mesFixture().configuracion, cuentaAhorroId: null } });
    expect(construirVistaAhorro(sinCuenta, [])).toEqual({ estado: "SIN_CUENTA", puedeConfigurar: true });

    const archivada = mesFixture({
      cuentas: [cuenta("nu", "Nu · ahorro", "CASA", 5, { tipo: "AHORRO", archivada: true })],
    });
    expect(construirVistaAhorro(archivada, []).estado).toBe("SIN_CUENTA");
  });

  it("ring: balance, goal, floored share and what is missing (canvas: 35 %, faltan 12.994.000)", () => {
    const v = listo(construirVistaAhorro(mesFixture(), []));
    expect(v.cuenta).toEqual({ id: "nu", nombre: "Nu · ahorro", saldo: 7_006_000 });
    expect(v.meta).toEqual({ monto: 20_000_000, porcentaje: 35, falta: 12_994_000 });
  });

  it("ring without a goal is null; a goal already met misses nothing", () => {
    const sinMeta = mesFixture({ configuracion: { ...mesFixture().configuracion, metaAhorro: null } });
    expect(listo(construirVistaAhorro(sinMeta, [])).meta).toBeNull();

    const cumplida = mesFixture({ configuracion: { ...mesFixture().configuracion, metaAhorro: 5_000_000 } });
    expect(listo(construirVistaAhorro(cumplida, [])).meta).toEqual({ monto: 5_000_000, porcentaje: 140, falta: 0 });
  });

  it("the cierre is the Casa equation «al cierre», minus the fijos still owed", () => {
    expect(sobranteCasa(mesFixture({ movimientos: movimientosNoviembre }))).toBe(631_000);

    const conFijoSinPagar = mesFixture({
      movimientos: movimientosNoviembre,
      categorias: [
        {
          id: "seguro",
          nombre: "Seguros Bolo",
          clase: "FIJO",
          monto: 170_000,
          periodicidad: "MENSUAL",
          mesAnual: null,
          diaPago: 20,
          activa: true,
          orden: 0,
          gastadoMes: 0,
          movimientosMes: 0,
          venceEnMes: true,
          fechaPagoMes: "2026-11-20",
          pagadoMes: false,
          proximoVencimiento: null,
          version: "v",
        },
      ],
    });
    expect(sobranteCasa(conFijoSinPagar)).toBe(461_000);
  });

  it("pending cierre: proposes the sobrante from the household account with the most money", () => {
    const data = mesFixture({
      movimientos: movimientosNoviembre,
      cuentas: [...mesFixture().cuentas, cuenta("casa2", "Daviplata casa", "CASA", 50_000, { tipo: "BILLETERA" })],
    });
    const { cierre, barras } = listo(construirVistaAhorro(data, []));
    expect(cierre).toMatchObject({
      titulo: "Cierre de noviembre",
      sobrante: 631_000,
      propuesto: 631_000,
      estado: "PENDIENTE",
      origenId: "casa",
      puedePasar: true,
      hecho: null,
    });
    // The savings account itself is never an origin.
    expect(cierre.origenes.map((o) => o.id)).toEqual(["casa", "casa2"]);
    // The current month's bar is the outline with the amount still to pass.
    expect(barras.at(-1)).toMatchObject({ mes: "2026-11", etiqueta: "Nov", valor: 631_000, texto: "631 mil", pendiente: true });
  });

  it("a cierre already passed is HECHO and its bar is filled, even if passed the next month", () => {
    const cierres: CierreAhorroRegistro[] = [
      { movimientoId: "m1", mes: "2026-10", fecha: "2026-11-02", monto: 7_000_000, anulado: false },
    ];
    const data = mesFixture({
      mes: "2026-10",
      historial: historial("2026-10"),
    });
    // Seen from October (closed month), with the transfer dated in November.
    const v = listo(construirVistaAhorro({ ...data, historial: historial("2026-10") }, cierres));
    expect(v.cierre.estado).toBe("HECHO");
    expect(v.cierre.hecho).toEqual({ monto: 7_000_000, fecha: "2026-11-02" });
    expect(v.barras.at(-1)).toMatchObject({ mes: "2026-10", valor: 7_000_000, texto: "7 M", pendiente: false });

    // Seen from November: the 7 M dated the 2nd belongs to October, not November.
    const nov = listo(
      construirVistaAhorro(mesFixture({ historial: historial("2026-11", { "2026-11": { depositosAhorro: 7_000_000 } }) }), cierres),
    );
    expect(nov.barras.find((b) => b.mes === "2026-10")?.valor).toBe(7_000_000);
    expect(nov.barras.find((b) => b.mes === "2026-11")?.valor).toBe(0);
  });

  it("a voided cierre does not count: the month is pending again", () => {
    const cierres: CierreAhorroRegistro[] = [
      { movimientoId: "m1", mes: "2026-11", fecha: "2026-11-25", monto: 631_000, anulado: true },
    ];
    const v = listo(construirVistaAhorro(mesFixture({ movimientos: movimientosNoviembre }), cierres));
    expect(v.cierre.estado).toBe("PENDIENTE");
  });

  it("nothing left over, a future month, no household account and read-only viewers", () => {
    expect(listo(construirVistaAhorro(mesFixture(), [])).cierre.estado).toBe("NADA");

    const futuro = listo(construirVistaAhorro(mesFixture({ mes: "2026-12", historial: historial("2026-12") }), []));
    expect(futuro.cierre).toMatchObject({ estado: "FUTURO", sobrante: 0 });

    const sinOrigen = mesFixture({ movimientos: movimientosNoviembre, cuentas: mesFixture().cuentas.filter((c) => c.id !== "casa") });
    expect(listo(construirVistaAhorro(sinOrigen, [])).cierre.estado).toBe("SIN_ORIGEN");

    const madre = mesFixture({ movimientos: movimientosNoviembre, usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } });
    const v = listo(construirVistaAhorro(madre, []));
    expect(v.cierre.puedePasar).toBe(false);
    expect(v.puedeConfigurar).toBe(false);
  });

  it("aviso 10 only once the month is over and only while its rule is on", () => {
    const octubre = mesFixture({
      mes: "2026-10",
      historial: historial("2026-10"),
      movimientos: movimientosNoviembre.map((m) => ({ ...m, fecha: m.fecha.replace("-11-", "-10-") })),
    });
    const v = listo(construirVistaAhorro(octubre, []));
    expect(v.avisos).toEqual([
      expect.objectContaining({ nivel: "atencion", elemento: "cierre:2026-10", texto: expect.stringContaining("faltan $ 631.000") }),
    ]);

    const apagada = { ...octubre, configuracion: { ...octubre.configuracion, reglas: reglas({ CIERRE_SOBRANTE_SIN_AHORRO: { activa: false } }) } };
    expect(listo(construirVistaAhorro(apagada, [])).avisos).toEqual([]);

    // Current month: the cierre has not happened yet.
    expect(listo(construirVistaAhorro(mesFixture({ movimientos: movimientosNoviembre }), [])).avisos).toEqual([]);
  });

  it("bar labels and cierre keys", () => {
    expect([0, 300_000, 631_000, 1_000_000, 2_500_000, 7_000_000].map(textoBarra)).toEqual([
      "—",
      "300 mil",
      "631 mil",
      "1 M",
      "2,5 M",
      "7 M",
    ]);
    expect(claveCierre("2026-11", 0)).toBe("ahorro-cierre-2026-11-0");
    expect(prefijoCierre("2026-11")).toBe("ahorro-cierre-2026-11-");
    expect(mesDeClaveCierre("ahorro-cierre-2026-11-3")).toBe("2026-11");
    expect(mesDeClaveCierre("6f1c2b9a-0000-4000-8000-000000000001")).toBeNull();
    // The key passes the operation-key format of the services.
    expect(claveCierre("2026-11", 12)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });
});

describe("vista Arqueo", () => {
  it("groups active accounts Negocio then Casa with «Lopest dice» in whole pesos", () => {
    const data = mesFixture({
      cuentas: [
        ...mesFixture().cuentas,
        cuenta("vieja", "Caja vieja", "NEGOCIO", 10, { archivada: true }),
        cuenta("cent", "Banco centavos", "CASA", 1_000.6, { saldoActual: 1_000.6 }),
      ],
    });
    const v = construirVistaArqueo(data);
    expect(v.grupos.map((g) => [g.etiqueta, g.cuentas.map((c) => c.nombre)])).toEqual([
      ["Negocio", ["Efectivo", "Bancolombia", "Nequi"]],
      ["Casa", ["Cuenta casa", "Nu · ahorro", "Banco centavos"]],
    ]);
    expect(v.totalCuentas).toBe(6);
    expect(v.grupos[0].cuentas[1]).toMatchObject({ saldoSistema: 11_900_000, saldoTexto: "$ 11.900.000" });
    expect(v.grupos[1].cuentas[2].saldoSistema).toBe(1_001);
  });

  it("history chips read like the canvas: date, account and signed difference, colored by what happened", () => {
    const data = mesFixture({
      arqueos: [
        { id: "a4", fecha: "2026-11-23T15:00:00.000Z", accionPor: null, nota: null, detalles: [{ cuentaId: "nequi", saldoSistema: 1_600_000, contado: 1_550_000, diferencia: -50_000 }] },
        { id: "a3", fecha: "2026-11-20T15:00:00.000Z", accionPor: null, nota: null, detalles: [{ cuentaId: "nequi", saldoSistema: 1, contado: 1, diferencia: 0 }] },
        { id: "a1", fecha: "2026-11-02T15:00:00.000Z", accionPor: null, nota: null, detalles: [{ cuentaId: "efectivo", saldoSistema: 0, contado: 20_000, diferencia: 20_000 }] },
      ],
    });
    expect(construirVistaArqueo(data).historial).toEqual([
      { id: "a4", texto: "23 nov · Nequi −$ 50.000", tono: "problema" },
      { id: "a3", texto: "20 nov · cuadró", tono: "ok" },
      { id: "a1", texto: "2 nov · Efectivo +$ 20.000", tono: "atencion" },
    ]);
  });

  it("aviso 5 follows the latest arqueo of each account; aviso 4 the days since the last count", () => {
    const data = mesFixture({
      hoy: "2026-11-25",
      cuentas: [
        cuenta("nequi", "Nequi", "NEGOCIO", 1_600_000, { ultimoArqueo: "2026-11-23T15:00:00.000Z" }),
        cuenta("efectivo", "Efectivo", "NEGOCIO", 1_320_000, { ultimoArqueo: "2026-11-23T15:00:00.000Z" }),
        cuenta("banco", "Bancolombia", "NEGOCIO", 11_900_000, { fechaSaldoInicial: "2026-11-01" }),
      ],
      arqueos: [
        { id: "a2", fecha: "2026-11-23T15:00:00.000Z", accionPor: null, nota: null, detalles: [
          { cuentaId: "nequi", saldoSistema: 1_600_000, contado: 1_550_000, diferencia: -50_000 },
          { cuentaId: "efectivo", saldoSistema: 1_320_000, contado: 1_320_000, diferencia: 0 },
        ] },
        // An older mismatch of Efectivo is cleared by the later count that matched.
        { id: "a1", fecha: "2026-11-10T15:00:00.000Z", accionPor: null, nota: null, detalles: [{ cuentaId: "efectivo", saldoSistema: 0, contado: 5, diferencia: 5 }] },
      ],
    });
    expect(construirVistaArqueo(data).avisos).toEqual([
      { nivel: "problema", texto: "Nequi: faltan $ 50.000", elemento: "cuenta:nequi" },
      { nivel: "atencion", texto: "Bancolombia sin contar hace 24 días", elemento: "cuenta:banco" },
    ]);

    const umbral30 = { ...data, configuracion: { ...data.configuracion, reglas: reglas({ CUENTA_SIN_CONTAR: { umbral: 30 }, ARQUEO_NO_CUADRA: { activa: false } }) } };
    expect(construirVistaArqueo(umbral30).avisos).toEqual([]);
  });

  it("only viewers with `contar` may count", () => {
    expect(construirVistaArqueo(mesFixture()).puedeContar).toBe(true);
    const sinContar = mesFixture({ usuario: { id: "m", nombre: "Madre", capacidades: ["VER", "ANOTAR"] } });
    expect(construirVistaArqueo(sinContar).puedeContar).toBe(false);
  });

  it("reads what was typed in «Contaste»", () => {
    expect(leerContado("")).toBeNull();
    expect(leerContado("  ")).toBeNull();
    expect(leerContado("1.320.000")).toBe(1_320_000);
    expect(leerContado("$ 1.320.000")).toBe(1_320_000);
    expect(leerContado("1320000")).toBe(1_320_000);
    expect(leerContado("0")).toBe(0);
    expect(leerContado("1.000,6")).toBe(1_001);
    expect(leerContado("abc")).toBeNull();
    expect(leerContado("-5")).toBeNull();
    expect(diaCorto("2026-11-02")).toBe("2 nov");
  });
});
