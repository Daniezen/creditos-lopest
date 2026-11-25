/**
 * Contract of `docs/specs/versiones.md`: the grammar of §3, the reading rule
 * of §4, the release transformation of §5, and the real web/CHANGELOG.md.
 *
 * Every rule has a case that must be refused, because a permissive parser is
 * exactly the failure this contract exists to prevent: a misread heading
 * moves a technical bullet into a module everyone reads.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AUDIENCES,
  ChangelogFormatError,
  compareVersions,
  currentVersion,
  parseChangelog,
  publishUnreleased,
  tokenizeInline,
} from "../changelog-format";
import { formatVersionDay, selectVisibleVersions } from "../version-visibility";

const file = (...blocks: string[]) => ["# Changelog", "", ...blocks].join("\n");

function expectRefusal(text: string, pattern: RegExp) {
  let caught: unknown;
  try {
    parseChangelog(text);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ChangelogFormatError);
  expect((caught as Error).message).toMatch(pattern);
}

describe("el CHANGELOG.md real", () => {
  it("es válido y su versión vigente es la publicada más alta", () => {
    // Vitest runs from web/, where the file lives and where the build reads it.
    const changelog = parseChangelog(readFileSync(path.resolve("CHANGELOG.md"), "utf8"));
    expect(changelog.versions.length).toBeGreaterThan(0);
    expect(currentVersion(changelog)).toBe(changelog.versions[0].version);
    expect(changelog.versions.some((entry) => entry.version === "1.0.0")).toBe(true);
  });
});

describe("gramática (§3)", () => {
  it("lee versiones, secciones y el bloque sin publicar", () => {
    const changelog = parseChangelog(
      file(
        "Texto de presentación.",
        "",
        "## [Sin publicar]",
        "### Técnico",
        "- Añadido Pendiente.",
        "",
        "## [1.1.0] - 2026-11-04",
        "### Créditos",
        "- Añadido el filtro por mora.",
        "### Técnico",
        "- Añadido el índice `credito_estado`.",
        "",
        "## [1.0.0] - 2026-09-02",
        "### General",
        "- Añadido el ingreso con Google.",
      ),
    );
    expect(changelog.unreleased).toEqual({ Técnico: ["Añadido Pendiente."] });
    expect(changelog.versions).toHaveLength(2);
    expect(changelog.versions[0].sections).toEqual({
      Créditos: ["Añadido el filtro por mora."],
      Técnico: ["Añadido el índice `credito_estado`."],
    });
    expect(currentVersion(changelog)).toBe("1.1.0");
  });

  it("acepta CRLF de un editor en Windows", () => {
    const changelog = parseChangelog(file("## [1.0.0] - 2026-09-02", "### General", "- Añadido a").replace(/\n/g, "\r\n"));
    expect(changelog.versions[0].sections.General).toEqual(["Añadido a"]);
  });

  it("regla 0: el título abre el archivo y hay como mucho un párrafo antes", () => {
    expectRefusal("Changelog\n\n## [1.0.0] - 2026-09-02\n### General\n- Añadido a", /abrir con/);
    expectRefusal(file("uno", "", "dos", "", "## [1.0.0] - 2026-09-02", "### General", "- Añadido a"), /un párrafo/);
    expectRefusal(file("- viñeta suelta", "", "## [1.0.0] - 2026-09-02", "### General", "- Añadido a"), /un párrafo/);
  });

  it("regla 1: forma del encabezado y días reales", () => {
    expectRefusal(file("## [1.0] - 2026-09-02", "### General", "- Añadido a"), /encabezado de versión inválido/);
    expectRefusal(file("## 1.0.0 - 2026-09-02", "### General", "- Añadido a"), /encabezado de versión inválido/);
    expectRefusal(file("## [1.0.0] - 2026-02-30", "### General", "- Añadido a"), /no es un día válido/);
  });

  it("regla 2: [Sin publicar] una sola vez y primero", () => {
    expectRefusal(
      file("## [1.0.0] - 2026-09-02", "### General", "- Añadido a", "## [Sin publicar]", "### General", "- Añadido b"),
      /solo puede aparecer una vez/,
    );
  });

  it("regla 3: versiones estrictamente descendentes y fechas no crecientes", () => {
    expectRefusal(
      file("## [1.0.0] - 2026-09-02", "### General", "- Añadido a", "## [1.0.0] - 2026-09-01", "### General", "- Añadido b"),
      /debe ser menor/,
    );
    expectRefusal(
      file("## [1.0.0] - 2026-09-02", "### General", "- Añadido a", "## [0.9.0] - 2026-09-03", "### General", "- Añadido b"),
      /posterior/,
    );
  });

  it("regla 4: solo los módulos del contrato, en orden, sin repetir ni vaciar", () => {
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### Novedades", "- Añadido a"), /sección desconocida/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### Técnico", "- Añadido a", "### Créditos", "- Añadido b"), /fuera del orden/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### Clientes", "- Añadido a", "### Clientes", "- Añadido b"), /repetida/);
    expectRefusal(file("## [1.0.0] - 2026-09-02"), /ninguna sección/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### Clientes", "### Técnico", "- Añadido a"), /está vacía/);
  });

  it("regla 4: el orden de los módulos es el de AUDIENCES, con Técnico al final", () => {
    expect(AUDIENCES.at(-1)).toBe("Técnico");
    const all = AUDIENCES.flatMap((audience) => [`### ${audience}`, `- Añadido ${audience}.`]);
    const changelog = parseChangelog(file("## [1.0.0] - 2026-09-02", ...all));
    expect(Object.keys(changelog.versions[0].sections)).toEqual([...AUDIENCES]);
  });

  it("regla 5: dentro de una sección solo hay viñetas", () => {
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### General", "Texto suelto"), /solo se admiten viñetas/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### General", "- Añadido a", "#### Detalle"), /solo se admiten viñetas/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "- Añadido sin sección"), /se esperaba una sección/);
  });

  it("regla 7: cada viñeta abre con un participio del vocabulario cerrado", () => {
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### General", "- Casilla en cada crédito."), /participio de lo que se hizo/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### General", "- Implementado el acceso."), /participio/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### General", "- Añade una casilla."), /participio/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### General", "- Añadidoscopio."), /participio/);
    expectRefusal(file("## [1.0.0] - 2026-09-02", "### General", "- añadida en minúscula."), /participio/);
    const bullets = ["Añadido el acceso.", "Corregida la pestaña.", "Retirados los avisos.", "Extraídas las reglas."];
    const changelog = parseChangelog(file("## [1.0.0] - 2026-09-02", "### General", ...bullets.map((bullet) => `- ${bullet}`)));
    expect(changelog.versions[0].sections.General).toEqual(bullets);
  });

  it("los errores citan la línea del archivo", () => {
    try {
      parseChangelog(file("## [1.0.0] - 2026-09-02", "### General", "- Casilla."));
      expect.unreachable();
    } catch (error) {
      expect((error as ChangelogFormatError).line).toBe(5);
    }
  });

  it("compara versiones numéricamente", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });
});

describe("marcas en línea (§3, regla 5)", () => {
  it("interpreta solo `código` y **negrita**; lo demás queda literal", () => {
    expect(tokenizeInline("Añadido `a` y **b** con [enlace](x) y <b>html</b>")).toEqual([
      { kind: "text", value: "Añadido " },
      { kind: "code", value: "a" },
      { kind: "text", value: " y " },
      { kind: "strong", value: "b" },
      { kind: "text", value: " con [enlace](x) y <b>html</b>" },
    ]);
  });

  it("un texto sin marcas es un solo token", () => {
    expect(tokenizeInline("Añadido el filtro.")).toEqual([{ kind: "text", value: "Añadido el filtro." }]);
  });
});

describe("lectura por rol (§4)", () => {
  const history = parseChangelog(
    file(
      "## [Sin publicar]",
      "### Créditos",
      "- Añadido En curso.",
      "### Técnico",
      "- Añadido Técnico en curso.",
      "## [1.1.1] - 2026-10-02",
      "### Técnico",
      "- Corregido Solo técnico.",
      "## [1.1.0] - 2026-10-01",
      "### Reportes",
      "- Añadido Reporte.",
      "### Técnico",
      "- Añadido Índice.",
      "## [1.0.0] - 2026-09-02",
      "### General",
      "- Añadido Inventario.",
    ),
  );

  it("quien no es técnico ve todas las versiones publicadas sin la sección Técnico", () => {
    const nodes = selectVisibleVersions({ changelog: history, technical: false });
    expect(nodes.map((node) => node.version)).toEqual(["1.1.0", "1.0.0"]);
    expect(nodes.flatMap((node) => node.sections.map((section) => section.audience))).not.toContain("Técnico");
  });

  it("una versión sin nada legible no genera nodo", () => {
    const nodes = selectVisibleVersions({ changelog: history, technical: false });
    expect(nodes.some((node) => node.version === "1.1.1")).toBe(false);
  });

  it("el lector técnico ve además Técnico y el bloque sin publicar, primero", () => {
    const nodes = selectVisibleVersions({ changelog: history, technical: true });
    expect(nodes.map((node) => node.version)).toEqual([null, "1.1.1", "1.1.0", "1.0.0"]);
    expect(nodes[0].released).toBe(false);
    expect(nodes[2].sections.map((section) => section.audience)).toEqual(["Reportes", "Técnico"]);
  });

  it("escribe el día de la versión sin moverlo por la zona horaria", () => {
    expect(formatVersionDay("2026-09-02")).toBe("2 de septiembre de 2026");
  });
});

describe("publicación (§5)", () => {
  const draft = file(
    "## [Sin publicar]",
    "### Créditos",
    "- Añadido Nuevo.",
    "",
    "## [1.0.0] - 2026-09-02",
    "### General",
    "- Añadido Viejo.",
  );
  const publish = (version: string, date = "2026-11-25") => publishUnreleased(draft, { version, date });

  it("renombra solo el encabezado sin publicar y deja un archivo válido", () => {
    const released = publish("1.1.0");
    expect(released).toBe(draft.replace("## [Sin publicar]", "## [1.1.0] - 2026-11-25"));
    const changelog = parseChangelog(released);
    expect(changelog.unreleased).toBeNull();
    expect(currentVersion(changelog)).toBe("1.1.0");
    expect(changelog.versions[0].sections).toEqual({ Créditos: ["Añadido Nuevo."] });
  });

  it("rechaza lo que rompería la historia", () => {
    expect(() => publish("1.0.0")).toThrow(/mayor que la vigente/);
    expect(() => publish("1.1")).toThrow(/no es una versión/);
    expect(() => publish("1.1.0", "2026-09-31")).toThrow(/no es un día/);
    expect(() => publish("1.1.0", "2026-08-01")).toThrow(/posterior/);
    expect(() =>
      publishUnreleased(file("## [1.0.0] - 2026-09-02", "### General", "- Añadido a"), { version: "1.1.0", date: "2026-11-25" }),
    ).toThrow(/no hay bloque/);
  });
});
