/**
 * Server render of the Configuración tab (no browser here): what the 1-dic
 * start needs to see at a glance (opening balance and its day on every
 * card, the savings goal next to the accounts), the read-only viewer with
 * nothing editable, and the touch-size contract of the small controls.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The Server Actions pull in Prisma; the markup only needs their references.
vi.mock("@/app/(casa-negocio)/casa-negocio/configuracion/actions", () => ({
  archivarCuentaAction: vi.fn(),
  crearCuentaAction: vi.fn(),
  crearGastoAction: vi.fn(),
  definirPermisosAction: vi.fn(),
  editarAvisoAction: vi.fn(),
  editarConfiguracionAction: vi.fn(),
  editarCuentaAction: vi.fn(),
  editarGastoAction: vi.fn(),
  eliminarCuentaAction: vi.fn(),
}));

import { cnConfigRecipes } from "@/design-system/recipes/casa-negocio-configuracion";
import type { VistaConfiguracion } from "@/server/casa-negocio/vista-configuracion";

import { Configuracion } from "../configuracion/configuracion";

const V = "2026-11-26T12:00:00.000Z";

function vista(cambios: Partial<VistaConfiguracion> = {}): VistaConfiguracion {
  return {
    puedeConfigurar: true,
    hoy: "2026-11-26",
    cuentas: [
      {
        id: "efectivo", nombre: "Efectivo", grupo: "NEGOCIO", tipo: "EFECTIVO", orden: 0, archivada: false,
        saldoInicial: 1_320_000, fechaSaldoInicial: "2026-12-01", saldoActual: 1_320_000, tieneMovimientos: false, esCuentaAhorro: false, version: V,
      },
      {
        id: "nu", nombre: "Nu · ahorro", grupo: "CASA", tipo: "AHORRO", orden: 1, archivada: false,
        saldoInicial: 7_006_000, fechaSaldoInicial: "2026-12-01", saldoActual: 7_006_000, tieneMovimientos: true, esCuentaAhorro: true, version: V,
      },
    ],
    gastos: [
      { id: "arriendo", nombre: "Arriendo", clase: "FIJO", monto: 1_787_000, periodicidad: "MENSUAL", mesAnual: null, diaPago: 17, activa: true, orden: 0, movimientos: 0, version: V },
    ],
    configuracion: { metaAsignacionCasa: 5_500_000, metaAhorro: 20_000_000, cuentaAhorroId: "nu", version: V },
    avisos: [{ codigo: "SOBRE_CERCA_DEL_TOPE", activa: true, umbral: 90, version: V }],
    personas: [
      { userId: "padre", nombre: "Padre", imagen: null, iniciales: "P", activo: true, esUsted: true, capacidades: ["VER", "ANOTAR", "CONTAR", "CONFIGURAR"] },
      { userId: "madre", nombre: "Madre", imagen: null, iniciales: "M", activo: true, esUsted: false, capacidades: ["VER"] },
    ],
    ...cambios,
  };
}

describe("Configuración markup", () => {
  it("each card shows its opening balance and day; the savings goal sits by the accounts", () => {
    const html = renderToStaticMarkup(<Configuracion vista={vista()} />);
    expect(html).toContain("Inicial $ 1.320.000 · 1 dic 2026");
    expect(html).toContain("Inicial $ 7.006.000 · 1 dic 2026");
    expect(html).toContain("Meta de ahorro");
    expect(html).toContain('value="$ 20.000.000"');
    expect(html).toContain('value="$ 5.500.000"');
    expect(html).toContain("+ Cuenta");
    // Switches carry their role and state.
    expect(html).toMatch(/role="switch" aria-checked="true"/);
  });

  it("no savings goal field until a savings account is chosen", () => {
    const sin = vista({ configuracion: { metaAsignacionCasa: null, metaAhorro: null, cuentaAhorroId: null, version: V } });
    expect(renderToStaticMarkup(<Configuracion vista={sin} />)).not.toContain("Meta de ahorro");
  });

  it("a read-only viewer gets values as text: no input, no add, no move, switches disabled", () => {
    const html = renderToStaticMarkup(<Configuracion vista={vista({ puedeConfigurar: false })} />);
    expect(html).not.toContain("<input");
    expect(html).not.toContain("+ Cuenta");
    expect(html).not.toContain("Pasar Arriendo a variables");
    expect(html).toContain("$ 20.000.000");
    expect((html.match(/role="switch"[^>]*disabled=""/g) ?? []).length).toBe((html.match(/role="switch"/g) ?? []).length);
  });

  it("small controls keep a 44px touch target", () => {
    expect(cnConfigRecipes.move).toContain("size-11");
    expect(cnConfigRecipes.capToggle).toContain("size-11");
    expect(cnConfigRecipes.archivedToggle).toContain("min-h-11");
    // The 26px switch drawing gets a taller transparent hit area.
    expect(cnConfigRecipes.switch).toContain("before:-inset-y-2.25");
  });
});
