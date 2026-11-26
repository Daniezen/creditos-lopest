/**
 * Armado de los modelos de vista del encabezado y del Tablero sobre un mes
 * del contrato de lectura (sin base de datos): el puente al motor, los avisos
 * con la configuración guardada, la navegación de mes, la línea del mes,
 * «Anotar» según capacidades y los estados vacío / sin movimientos.
 */
import { describe, expect, it } from "vitest";

import { construirEncabezado, navegacionMes, prefillDe, resolverMes } from "../vista-encabezado";
import { configAvisosDe, evaluarMes } from "../vista-mes";
import { construirTablero } from "../vista-tablero";
import { mesDiciembre, reglas } from "./mes.fixture";

function encabezado(datos = mesDiciembre(), consulta: Record<string, string> = {}) {
  return construirEncabezado({ datos, evaluado: evaluarMes(datos), tab: "tablero", consulta });
}

function tablero(datos = mesDiciembre()) {
  const vista = construirTablero(datos, evaluarMes(datos));
  if (vista.estado !== "listo") throw new Error("esperaba un Tablero listo");
  return vista.data;
}

describe("puente al motor", () => {
  it("arma las cuentas del mes a partir de las lecturas", () => {
    const { calculo } = evaluarMes(mesDiciembre());
    expect(calculo.negocio).toMatchObject({ intereses: 200_000, gastos: 180_000, ganancia: 20_000, retirosCasa: 3_000_000, reinvertido: -2_980_000 });
    expect(calculo.casa).toMatchObject({ entro: 3_000_000, fijos: 1_787_000, variables: 186_000, hoy: 1_027_000, fijosSinPagar: 32_000, alCierre: 995_000 });
  });

  it("traduce los códigos de aviso guardados a las reglas del motor", () => {
    const datos = mesDiciembre();
    datos.configuracion.reglas = reglas({ FIJO_VENCIDO_SIN_PAGAR: { activa: false }, CUENTA_SIN_CONTAR: { umbral: 30 } });
    expect(configAvisosDe(datos)).toMatchObject({ FIJO_VENCIDO: { activa: false }, CUENTA_SIN_CONTAR: { activa: true, umbral: 30 } });
    const ids = evaluarMes(datos).avisos.map((a) => a.reglaId);
    expect(ids).not.toContain("FIJO_VENCIDO");
    expect(ids).not.toContain("CUENTA_SIN_CONTAR");
  });

  it("redondea montos con centavos antes del motor (que exige pesos enteros)", () => {
    const datos = mesDiciembre();
    datos.cobros[0] = { ...datos.cobros[0], interes: 200_000.4 };
    expect(evaluarMes(datos).calculo.negocio.intereses).toBe(200_000);
  });
});

describe("mes activo y navegación", () => {
  it("usa ?mes=AAAA-MM válido y si no el mes de hoy", () => {
    expect(resolverMes("2027-01", "2026-12-20")).toBe("2027-01");
    expect(resolverMes("2027-13", "2026-12-20")).toBe("2026-12");
    expect(resolverMes(undefined, "2026-12-20")).toBe("2026-12");
  });

  it("no retrocede antes del inicio del módulo ni avanza más de doce meses", () => {
    expect(navegacionMes("2026-12", "2026-12", "2026-12-01")).toEqual({ anterior: null, siguiente: "2027-01" });
    expect(navegacionMes("2027-12", "2026-12", "2026-12-01").siguiente).toBeNull();
    expect(navegacionMes("2026-12", "2026-12", null).anterior).toBe("2026-11");
  });

  it("las flechas y pestañas conservan el mes; el mes de hoy no lleva parámetro", () => {
    const datos = mesDiciembre({ mes: "2027-01" });
    const h = encabezado(datos);
    expect(h.month).toMatchObject({ title: "Enero", year: "2027", prevHref: "/casa-negocio", nextHref: "/casa-negocio?mes=2027-02" });
    expect(h.tabQuery).toBe("mes=2027-01");
    expect(encabezado().tabQuery).toBeUndefined();
  });
});

describe("línea del mes", () => {
  const line = encabezado().line;

  it("marca hechos, por venir, sin pagar y el cierre, sin los cobros ya hechos", () => {
    expect(line.marks.map((m) => [m.day, m.kind, m.label])).toEqual([
      [1, "entrada", "Retiro +3,0 M"],
      [16, "vencido", "Funeraria"],
      [17, "pagado", "Arriendo"],
      [27, "viene", "1 cobro"],
      [31, "cierre", "Cierre"],
    ]);
    expect(line).toMatchObject({ daysInMonth: 31, today: 20, period: "actual", monthName: "diciembre" });
  });

  it("cada ventanita lleva su acción real", () => {
    const porId = Object.fromEntries(line.marks.map((m) => [m.id, m.action]));
    expect(porId["fijo:funeraria"]).toEqual({ label: "Pagar", href: "/casa-negocio?anotar=gastoCasa&categoria=funeraria&monto=32000" });
    expect(porId["cobro-esperado:2026-12-27"]).toEqual({ label: "Ver cuotas", href: "/creditos" });
    expect(porId["cierre:2026-12"]).toEqual({ label: "Ir a Ahorro", href: "/casa-negocio/ahorro" });
  });

  it("un mes pasado se dibuja lleno y sin HOY", () => {
    const pasado = encabezado(mesDiciembre({ hoy: "2027-01-05" })).line;
    expect(pasado).toMatchObject({ today: null, period: "pasado" });
  });
});

describe("Anotar y capacidades", () => {
  it("sin anotar: solo lectura y sin panel", () => {
    const h = encabezado(mesDiciembre({ usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } }));
    expect(h.readOnly).toBe(true);
    expect(h.quickEntry).toBeNull();
  });

  it("con anotar pero sin cuentas: no hay dónde anotar, sin el sello de solo lectura", () => {
    const h = encabezado(mesDiciembre({ cuentas: [] }));
    expect(h.readOnly).toBe(false);
    expect(h.quickEntry).toBeNull();
  });

  it("ofrece las cuentas por grupo, los fijos sin pagar primero y los saldos para el aviso 7", () => {
    const options = encabezado().quickEntry!.options;
    expect(options.cuentasNegocio.map((o) => o.value)).toEqual(["bancolombia", "nequi"]);
    expect(options.cuentasCasa.map((o) => o.value)).toEqual(["casa", "nu"]);
    expect(options.categoriasCasa[0]).toEqual({ value: "funeraria", label: "Funeraria · sin pagar" });
    expect(options.origenesAporte[0]).toEqual({ value: "cuenta:casa", label: "Desde Cuenta casa" });
    expect(options.saldos.bancolombia).toBe(11_900_000);
    expect(options.avisoSinSaldo).toBe(true);
  });

  it("abre el panel precargado desde «Pagar» e ignora valores raros", () => {
    expect(encabezado(mesDiciembre(), { anotar: "gastoCasa", categoria: "funeraria", monto: "32000" }).quickEntry!.prefill).toEqual({
      kind: "gastoCasa",
      values: { categoria: "funeraria" },
      monto: "32000",
    });
    expect(prefillDe({ anotar: "borrarTodo" })).toBeNull();
    expect(prefillDe({ anotar: "gastoCasa", categoria: "<script>", monto: "1e9" })).toEqual({ kind: "gastoCasa", values: {}, monto: undefined });
  });
});

describe("Tablero", () => {
  it("sin cuentas lleva a Configuración (o lo dice, si no puede configurar)", () => {
    expect(construirTablero(mesDiciembre({ cuentas: [] }), evaluarMes(mesDiciembre({ cuentas: [] })))).toEqual({
      estado: "sin-cuentas",
      puedeConfigurar: true,
      hrefConfiguracion: "/casa-negocio/configuracion",
    });
    const madre = mesDiciembre({ cuentas: [], usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } });
    expect(construirTablero(madre, evaluarMes(madre))).toMatchObject({ puedeConfigurar: false });
  });

  it("un mes sin movimientos lo dice en vez de barras vacías", () => {
    const quieto = mesDiciembre({ mes: "2027-02", movimientos: [], cobros: [], cuotasPorCobrar: [] });
    expect(tablero(quieto).quietMonth).toBe("Sin movimientos en febrero.");
    expect(tablero().quietMonth).toBeUndefined();
  });

  it("por dónde pasó la plata suma lo mismo en los pasos 1 y 2", () => {
    const { entered, left, house } = tablero().moneyPath;
    const entro = entered.interest + entered.capitalReturned + (entered.contributions ?? 0) + (entered.fromBefore ?? 0);
    expect(entro).toBe(left.newLoans + left.expenses + left.toHouse + left.remained);
    expect(entered.fromBefore).toBe(2_180_000);
    expect(house).toEqual({ fixed: 1_787_000, variable: 186_000, surplus: 1_027_000 });
  });

  it("las ecuaciones llevan los avisos reales (6 en Negocio, 3 en Casa)", () => {
    const [negocio, casa] = tablero().equations;
    expect(negocio.terms.find((t) => t.label === "Reinvertido")!.amount).toBe(-2_980_000);
    expect(negocio.notices?.map((n) => n.level)).toEqual(["problema"]);
    expect(casa.notices?.[0].text).toBe("Si se gasta lo que queda en los sobres, diciembre cierra en −$ 1.719.000.");
  });

  it("un aviso apagado en Configuración no aparece", () => {
    const datos = mesDiciembre();
    datos.configuracion.reglas = reglas({ RETIRO_SUPERA_GANANCIA: { activa: false }, SOBRES_CIERRE_NEGATIVO: { activa: false } });
    const [negocio, casa] = tablero(datos).equations;
    expect(negocio.notices).toBeUndefined();
    expect(casa.notices).toBeUndefined();
  });

  it("dónde está la plata: saldos por cuenta con su estado de arqueo", () => {
    const money = tablero().money;
    expect(money.total).toBe(21_339_000);
    expect(money.accounts.map((a) => [a.name, a.swatch, a.status.text, a.status.tone])).toEqual([
      ["Bancolombia", "ink", "Sin contar hace 19 días", "neutral"],
      ["Nu", "ahorro", "Sin contar hace 19 días", "neutral"],
      ["Nequi", "ink-soft", "Faltan $ 50.000", "problema"],
      ["Cuenta casa", "casa", "Sin contar hace 19 días", "neutral"],
    ]);
  });

  it("en la calle avisa los créditos sin pagos hace más de N días", () => {
    const datos = mesDiciembre();
    datos.cartera.creditos = [
      {
        creditoId: "lento",
        creditoCodigo: "L-1",
        clienteNombre: "Lento",
        dueno: null,
        esPropio: true,
        saldoCapital: 8_400_000,
        diasAtraso: 120,
        tramo: "MAS_90",
        montoVencido: 1_000_000,
        ultimoPago: "2026-08-01",
        diasSinPago: 141,
        castigado: false,
      },
    ];
    expect(tablero(datos).street).toEqual({
      amount: 186_400_000,
      activeCredits: 42,
      stale: { text: "1 crédito sin pagos hace más de 90 días · $ 8,4 M", href: "/creditos" },
    });
  });

  it("sobres con el umbral guardado; con el aviso 2 apagado nunca se ponen ámbar", () => {
    expect(tablero().envelopes).toEqual([
      { id: "gasolina", name: "Gasolina", spent: 186_000, cap: 200_000 },
      { id: "mercado", name: "Mercado", spent: 0, cap: 2_700_000 },
    ]);
    expect(tablero().envelopeNearShare).toBe(0.9);
    const datos = mesDiciembre();
    datos.configuracion.reglas = reglas({ SOBRE_CERCA_DEL_TOPE: { activa: false } });
    expect(tablero(datos).envelopeNearShare).toBe(Number.POSITIVE_INFINITY);
  });

  it("calendario: cobros, casa, lo que falta y el conteo pendiente hoy", () => {
    const { days, today } = tablero().calendar;
    expect(today).toBe(20);
    expect(days[5]).toEqual([{ kind: "cobro", text: "1 cuota cobrada · $ 1.000.000", action: undefined }]);
    expect(days[16][0]).toMatchObject({ kind: "falta", text: "Funeraria · $ 32.000", action: { label: "Pagar" } });
    expect(days[17][0]).toMatchObject({ kind: "casa", text: "Arriendo · pagado" });
    expect(days[20].map((e) => e.action?.label)).toEqual(["Contar", "Contar", "Contar", "Contar"]);
    expect(days[31][0]).toMatchObject({ kind: "ahorro", action: { label: "Ahorrar", href: "/casa-negocio/ahorro" } });
  });

  it("en el celular, lo primero es pagar el fijo vencido", () => {
    expect(tablero().next).toEqual({
      title: "Pagar Funeraria",
      detail: "$ 32.000 · venció el 16",
      href: "/casa-negocio?anotar=gastoCasa&categoria=funeraria&monto=32000",
      more: 4,
    });
  });
});
