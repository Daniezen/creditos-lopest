/**
 * The 10 avisos of spec §5 over the December/January story: each one fires
 * exactly when its condition holds, stays silent otherwise, follows its
 * switch and threshold from Configuración, and every tab that shows it says
 * the same thing.
 */
import { describe, expect, it } from "vitest";

import { avisoSinSaldo } from "@/components/casa-negocio/casa/aviso-salida";
import type { ReglaAvisoId } from "@/features/casa-negocio/domain";

import { evaluarMes } from "../../vista-mes";
import { construirVistaAhorro } from "../../vista-ahorro";
import { construirVistaArqueo } from "../../vista-arqueo";
import { construirVistaCasa } from "../../vista-casa";

import { cierresDe, clonar, leerMes, local, mundoBase, type Mundo } from "./mundo.fixture";

const D19 = local("2026-12-19", "12:00");
const D21 = local("2026-12-21", "12:00");
const D23 = local("2026-12-23", "12:00");
const E01 = local("2027-01-01", "10:00");
const E20 = local("2027-01-20", "12:00");

function avisos(mundo: Mundo, mes: string, ahora: Date, regla: ReglaAvisoId) {
  return evaluarMes(leerMes(mundo, mes, ahora)).avisos.filter((a) => a.reglaId === regla);
}
const conReglas = (reglas: Mundo["reglas"]) => ({ ...mundoBase(), reglas });

describe("1 · gasto fijo vencido sin pagar (problema)", () => {
  it("servicios vence el 20: el 21 avisa; el 23, ya pagado, calla", () => {
    expect(avisos(mundoBase(), "2026-12", D19, "FIJO_VENCIDO")).toEqual([]);
    const [a] = avisos(mundoBase(), "2026-12", D21, "FIJO_VENCIDO");
    expect(a).toMatchObject({ nivel: "PROBLEMA", elemento: "fijo:servicios", montos: { pendiente: 300_000 } });
    expect(avisos(mundoBase(), "2026-12", D23, "FIJO_VENCIDO")).toEqual([]);
  });
  it("el día del vencimiento todavía está a tiempo", () => {
    expect(avisos(mundoBase(), "2027-01", E20, "FIJO_VENCIDO")).toEqual([]);
  });
  it("Casa lo muestra junto al fijo; apagado en Configuración, calla", () => {
    const casa = construirVistaCasa(leerMes(mundoBase(), "2026-12", D21));
    expect(casa.fijos.find((f) => f.id === "servicios")).toMatchObject({ estado: "vencido", avisos: [{ nivel: "problema" }] });
    expect(avisos(conReglas({ FIJO_VENCIDO_SIN_PAGAR: { activa: false } }), "2026-12", D21, "FIJO_VENCIDO")).toEqual([]);
  });
});

describe("2 · sobre cerca del tope (atención, umbral 90)", () => {
  it("gasolina 280.000 de 300.000 (93 %) avisa; mercado al 45 % no", () => {
    const lista = avisos(mundoBase(), "2026-12", D21, "SOBRE_CERCA_TOPE");
    expect(lista.map((a) => a.elemento)).toEqual(["sobre:gasolina"]);
    expect(lista[0].texto).toBe("Gasolina va en el 93 % del tope");
  });
  it("con umbral 94 calla; con umbral 40 también avisa mercado", () => {
    expect(avisos(conReglas({ SOBRE_CERCA_DEL_TOPE: { umbral: 94 } }), "2026-12", D21, "SOBRE_CERCA_TOPE")).toEqual([]);
    const bajo = avisos(conReglas({ SOBRE_CERCA_DEL_TOPE: { umbral: 40 } }), "2026-12", D21, "SOBRE_CERCA_TOPE");
    expect(bajo.map((a) => a.elemento)).toEqual(["sobre:mercado", "sobre:gasolina"]);
  });
  it("el nivel del sobre en Casa usa el mismo umbral", () => {
    const casa = construirVistaCasa(leerMes(conReglas({ SOBRE_CERCA_DEL_TOPE: { umbral: 94 } }), "2026-12", D21));
    expect(casa.sobres.find((s) => s.id === "gasolina")).toMatchObject({ nivel: "NORMAL", avisos: [] });
  });
});

describe("3 · si se gastan los sobres el mes cierra en negativo (atención)", () => {
  it("diciembre: al cierre 420.000 − quedan 1.120.000 = −700.000", () => {
    const [a] = avisos(mundoBase(), "2026-12", D21, "SOBRES_CIERRE_NEGATIVO");
    expect(a.montos).toEqual({ siSeGastanSobres: -700_000, quedaEnSobres: 1_120_000, alCierre: 420_000 });
  });
  it("con topes bajos (lo que queda cabe en el cierre) calla", () => {
    const m = mundoBase();
    m.categorias.find((c) => c.id === "mercado")!.monto = 1_000_000; // queda 100.000 + 20.000 < 420.000
    expect(avisos(m, "2026-12", D21, "SOBRES_CIERRE_NEGATIVO")).toEqual([]);
  });
  it("un mes ya cerrado no avisa: los sobres ya no se pueden gastar", () => {
    expect(avisos(mundoBase(), "2026-12", E20, "SOBRES_CIERRE_NEGATIVO")).toEqual([]);
  });
});

describe("4 · cuenta sin contar hace más de N días (atención, 7)", () => {
  it("el 8-dic (7 días desde el arranque) calla; el 9 avisa por las cinco", () => {
    expect(avisos(mundoBase(), "2026-12", local("2026-12-08"), "CUENTA_SIN_CONTAR")).toEqual([]);
    expect(avisos(mundoBase(), "2026-12", local("2026-12-09"), "CUENTA_SIN_CONTAR")).toHaveLength(5);
  });
  it("el 21, tras contar el efectivo, avisa por las otras cuatro", () => {
    const lista = avisos(mundoBase(), "2026-12", local("2026-12-21", "19:00"), "CUENTA_SIN_CONTAR");
    expect(lista.map((a) => a.elemento).sort()).toEqual(["cuenta:banco", "cuenta:casa", "cuenta:nequi", "cuenta:nu"]);
  });
  it("el umbral sale de Configuración y Arqueo dice lo mismo que el Tablero", () => {
    const m = conReglas({ CUENTA_SIN_CONTAR: { umbral: 30 } });
    expect(avisos(m, "2026-12", local("2026-12-21", "19:00"), "CUENTA_SIN_CONTAR")).toEqual([]);
    const datos = leerMes(mundoBase(), "2027-01", E20);
    const tablero = evaluarMes(datos).avisos.filter((a) => a.reglaId === "CUENTA_SIN_CONTAR" || a.reglaId === "ARQUEO_NO_CUADRA");
    const arqueo = construirVistaArqueo(datos).avisos;
    expect(arqueo.map((a) => a.texto).sort()).toEqual(tablero.map((a) => a.texto).sort());
  });
});

describe("5 · un arqueo no cuadra (problema)", () => {
  it("efectivo contado 1.400.000 contra 1.420.000: faltan 20.000", () => {
    const [a] = avisos(mundoBase(), "2026-12", local("2026-12-21", "19:00"), "ARQUEO_NO_CUADRA");
    expect(a).toMatchObject({ nivel: "PROBLEMA", elemento: "cuenta:efectivo", texto: "Efectivo: faltan $ 20.000", montos: { diferencia: -20_000 } });
  });
  it("un recuento posterior que cuadra lo apaga", () => {
    const m = mundoBase();
    m.arqueos.push({ id: "arq-2", fecha: local("2026-12-22", "09:00").toISOString(), detalles: [{ cuentaId: "efectivo", saldoSistema: 1_420_000, contado: 1_420_000 }] });
    expect(avisos(m, "2026-12", D23, "ARQUEO_NO_CUADRA")).toEqual([]);
    expect(construirVistaArqueo(leerMes(m, "2026-12", D23)).avisos.some((a) => a.elemento === "cuenta:efectivo" && a.nivel === "problema")).toBe(false);
  });
});

describe("6 · a la casa más de lo que ganó el negocio (problema)", () => {
  it("diciembre: retiros 3.000.000 contra ganancia −1.080.000", () => {
    const [a] = avisos(mundoBase(), "2026-12", E20, "RETIRO_MAYOR_GANANCIA");
    expect(a.montos).toEqual({ exceso: 4_080_000, retirosCasa: 3_000_000, ganancia: -1_080_000 });
  });
  it("enero: retiro 100.000 contra ganancia 120.000, calla", () => {
    expect(avisos(mundoBase(), "2027-01", E20, "RETIRO_MAYOR_GANANCIA")).toEqual([]);
  });
});

describe("7 · un movimiento dejaría una cuenta sin saldo (problema)", () => {
  it("sacar más de lo que tiene la cuenta de la casa avisa; vaciarla justo a 0 no", () => {
    const casa = leerMes(mundoBase(), "2027-01", E20).cuentas.find((c) => c.id === "casa")!;
    expect(casa.saldoActual).toBe(1_400_000);
    expect(avisoSinSaldo(casa, 1_400_001)).toBe("Cuenta casa quedaría en −$ 1");
    expect(avisoSinSaldo(casa, 1_400_000)).toBeNull();
  });
});

describe("8 · crédito sin pagos hace más de N días (atención, 90)", () => {
  it("antes del castigo, D (sin pagos desde junio) avisa solo", () => {
    const [a] = avisos(mundoBase(), "2026-12", D19, "CREDITO_SIN_PAGOS");
    expect(a).toMatchObject({ refs: ["cr-d"], montos: { saldo: 2_000_000 } });
  });
  it("castigado sale del aviso; revertido el castigo, vuelve", () => {
    expect(avisos(mundoBase(), "2026-12", D21, "CREDITO_SIN_PAGOS")).toEqual([]);
    const m = mundoBase();
    m.castigos[0].revertido = true;
    expect(avisos(m, "2027-01", E20, "CREDITO_SIN_PAGOS")[0]?.refs).toEqual(["cr-d"]);
  });
  it("con umbral 365 calla", () => {
    expect(avisos(conReglas({ CREDITO_SIN_PAGOS: { umbral: 365 } }), "2026-12", D19, "CREDITO_SIN_PAGOS")).toEqual([]);
  });
});

describe("9 · gasto anual vence en menos de N días (atención, 30)", () => {
  it("SOAT (25-ene): el 21-dic faltan 35 días y calla; el 20-ene faltan 5 y avisa", () => {
    expect(avisos(mundoBase(), "2026-12", D21, "ANUAL_POR_VENCER")).toEqual([]);
    const [a] = avisos(mundoBase(), "2027-01", E20, "ANUAL_POR_VENCER");
    expect(a).toMatchObject({ elemento: "fijo:soat", montos: { pendiente: 900_000 } });
  });
  it("con umbral 40 ya avisa en diciembre; pagado, calla", () => {
    expect(avisos(conReglas({ GASTO_ANUAL_PROXIMO: { umbral: 40 } }), "2026-12", D21, "ANUAL_POR_VENCER")).toHaveLength(1);
    const m = mundoBase();
    m.movimientos.push({ id: "e-soat", tipo: "GASTO_FIJO", fecha: "2027-01-15", monto: 900_000, origen: "casa", categoria: "soat" });
    expect(avisos(m, "2027-01", E20, "ANUAL_POR_VENCER")).toEqual([]);
  });
  it("predial (junio) nunca avisa en diciembre ni enero", () => {
    expect(avisos(mundoBase(), "2027-01", E20, "ANUAL_POR_VENCER").some((a) => a.elemento === "fijo:predial")).toBe(false);
  });
});

describe("10 · pasó el cierre y lo sobrante no está en el ahorro (atención)", () => {
  it("en diciembre (mes abierto) calla; el 1-ene avisa; tras pasarlo, calla", () => {
    expect(avisos(mundoBase(), "2026-12", D21, "CIERRE_SIN_AHORRO")).toEqual([]);
    expect(avisos(mundoBase(), "2027-01", E01, "CIERRE_SIN_AHORRO")).toHaveLength(1);
    expect(avisos(mundoBase(), "2027-01", E20, "CIERRE_SIN_AHORRO")).toEqual([]);
  });
  it("anulado el «Pasar al ahorro», vuelve a avisar en Tablero y en Ahorro", () => {
    const m = mundoBase();
    m.movimientos.find((x) => x.id === "e-cierre-dic")!.anulado = true;
    expect(avisos(m, "2027-01", E20, "CIERRE_SIN_AHORRO")[0]?.montos.falta).toBe(420_000);
    const ahorro = construirVistaAhorro(leerMes(m, "2026-12", E20), cierresDe(m, E20));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(ahorro.cierre.estado).toBe("PENDIENTE");
    expect(ahorro.avisos).toHaveLength(1);
  });

  /**
   * December closes with services UNPAID. Spec §3: «al cierre» = hoy − fijos
   * sin pagar = 720.000 − 300.000, and Ahorro proposes exactly that (420.000).
   * The Tablero's rule 10 must speak of the same leftover, not of «hoy»
   * (720.000, what it said before the bridge read `cierreAnterior`).
   */
  it("el sobrante del aviso en el Tablero es el «al cierre» que propone Ahorro", () => {
    const m = clonar(mundoBase());
    m.movimientos = m.movimientos.filter((x) => x.id !== "d-servicios" && x.id !== "e-cierre-dic");
    const ahorro = construirVistaAhorro(leerMes(m, "2026-12", E20), cierresDe(m, E20));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(ahorro.cierre.sobrante).toBe(420_000);
    const [a] = avisos(m, "2027-01", E20, "CIERRE_SIN_AHORRO");
    expect(a?.montos.sobrante).toBe(ahorro.cierre.sobrante);
  });

  /**
   * Money moved to Nu with a plain «Traslado» from Anotar is not a cierre:
   * Ahorro still shows December PENDIENTE and offers the button. The Tablero
   * must agree (both count cierre movements, keyed `ahorro-cierre-AAAA-MM-n`).
   */
  it("un traslado suelto a Nu no cuenta como cierre ni en Ahorro ni en el Tablero", () => {
    const m = mundoBase();
    const cierre = m.movimientos.find((x) => x.id === "e-cierre-dic")!;
    delete cierre.clave;
    const ahorro = construirVistaAhorro(leerMes(m, "2026-12", E20), cierresDe(m, E20));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(ahorro.cierre.estado).toBe("PENDIENTE");
    expect(avisos(m, "2027-01", E20, "CIERRE_SIN_AHORRO")).toHaveLength(1);
  });

  it("apagado en Configuración, calla en Tablero y Ahorro", () => {
    const m = conReglas({ CIERRE_SOBRANTE_SIN_AHORRO: { activa: false } });
    expect(avisos(m, "2027-01", E01, "CIERRE_SIN_AHORRO")).toEqual([]);
    const ahorro = construirVistaAhorro(leerMes(m, "2026-12", E01), cierresDe(m, E01));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(ahorro.avisos).toEqual([]);
  });
});
