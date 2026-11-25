import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_CALENDAR_OPEN_DAY, demoHeader, demoTablero } from "../fixtures/canvas-noviembre";
import { ModulePage } from "../module-page";
import { Notice } from "../shared/notice";
import { ModuleUserProvider } from "../shell/module-user-context";
import { Tablero } from "../tablero/tablero";

/**
 * Server render of the demo pages (no browser here): checks the markup
 * contract that matters for accessibility and for the canvas — real buttons,
 * the states announced, the active tab, read-only mode.
 */
const user = { nombre: "Padre", image: null, roleNames: ["Administrador"] };

function page(readOnly = false) {
  const header = { ...demoHeader("tablero"), readOnly };
  return renderToStaticMarkup(
    <ModuleUserProvider user={user}>
      <ModulePage header={header}>
        <Tablero data={demoTablero} readOnly={readOnly} calendarOpenDay={DEMO_CALENDAR_OPEN_DAY} />
      </ModulePage>
    </ModuleUserProvider>,
  );
}

describe("Tablero demo markup", () => {
  const html = page();

  it("renders every month mark as a real disclosure button named by its title and date", () => {
    const marks = html.match(/<button[^>]*aria-label="[^"]*"[^>]*aria-expanded="false"/g) ?? [];
    expect(marks.length).toBeGreaterThanOrEqual(10);
    expect(html).toContain('aria-label="Cierre de noviembre, 30 de noviembre"');
    expect(html).toContain('aria-label="5 cuotas por cobrar hoy, Hoy"');
  });

  it("marks the active folder tab and keeps the three groups", () => {
    expect(html).toMatch(/aria-current="page"[^>]*>Tablero<\/a>|href="\/casa-negocio"[^>]*aria-current="page"/);
    expect((html.match(/<nav aria-label="Secciones"/g) ?? []).length).toBe(1);
  });

  it("offers «Anotar» and the floating button when the user can write", () => {
    expect(html).toContain(">Anotar</button>");
    expect(html).toContain('aria-label="Anotar movimiento"');
    expect(html).not.toContain("Solo lectura");
  });

  it("opens the canvas' calendar day with its actions", () => {
    expect(html).toContain('aria-label="20 de noviembre, 3 eventos"');
    expect(html).toContain('role="dialog" aria-label="20 de noviembre"');
    expect(html).toContain(">Pagar</a>");
    expect(html).toContain('aria-current="date"');
  });

  it("announces the notice level without relying on colour", () => {
    expect(html).toContain("Atención: </span>Si se gasta lo que queda en los sobres");
  });

  it("hides every write action in read-only mode", () => {
    const readOnly = page(true);
    expect(readOnly).toContain("Solo lectura");
    expect(readOnly).not.toContain(">Anotar</button>");
    expect(readOnly).not.toContain('aria-label="Anotar movimiento"');
    expect(readOnly).not.toContain(">Pagar</a>");
  });
});

describe("Notice", () => {
  it("speaks and draws the problem level", () => {
    const html = renderToStaticMarkup(<Notice level="problema">Un arqueo no cuadra.</Notice>);
    expect(html).toContain("Problema: ");
    expect(html).toContain("cn-color-problem-surface");
  });
});
