/**
 * Parser and validator of `web/CHANGELOG.md` — contract: `docs/specs/versiones.md` §3.
 *
 * Ported from Plataforma Impulsa. The file lives in `web/` (not the repository
 * root) because `web/` is the Docker build context: a root file would never
 * reach the image. It is the ONLY source of Lopest's version history: GitHub
 * renders it as-is, and the app reads it through this parser. There is no
 * database copy and no `package.json` version to keep in sync, so there is
 * nothing that can drift from it.
 *
 * WHY A STRICT PARSER. Sections are product modules plus one `Técnico`
 * section that only administrators read. A heading the parser half-understood
 * would silently attach a technical bullet to a module everyone reads. So
 * anything outside the grammar is an error with a line number, and the build
 * refuses to continue (`scripts/versiones/check-changelog.mjs`).
 *
 * CONSTRAINTS ON THIS MODULE. It is executed by plain Node during the build
 * (type stripping, no bundler, no path aliases), so it must stay free of
 * imports and use only erasable TypeScript syntax: no enums, no namespaces,
 * no parameter properties.
 */

/**
 * The sections a version may contain, in the order the contract fixes. They
 * mirror the dashboard modules (`config/navigation.ts`) so a non-technical
 * reader finds changes where they work; `General` covers what crosses modules
 * (sign-in, navigation, branding) and `Técnico` is always last and restricted.
 *
 * The name `AUDIENCES` is kept from Impulsa so the two parsers stay diffable;
 * in Lopest a section is a module, and only `Técnico` is an audience cut.
 */
export const AUDIENCES = ["General", "Simulador", "Clientes", "Créditos", "Transferencias", "Reportes", "Técnico"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** The only section whose reading is restricted (to `ADMIN`). */
export const TECHNICAL_SECTION: Audience = "Técnico";

/** The literal heading of the block that accumulates work between releases. */
export const UNRELEASED_LABEL = "Sin publicar";

export type ChangelogSections = Partial<Record<Audience, string[]>>;

export type ReleasedVersion = {
  /** `X.Y.Z`, without the `v` prefix the tags carry. */
  version: string;
  /** Calendar day `AAAA-MM-DD`, as written in the heading. */
  date: string;
  sections: ChangelogSections;
};

export type Changelog = {
  /** Null when the file has no `[Sin publicar]` block. */
  unreleased: ChangelogSections | null;
  /** Newest first, exactly as the file orders them. */
  versions: ReleasedVersion[];
};

export class ChangelogFormatError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(`CHANGELOG.md, línea ${line}: ${message}`);
    this.name = "ChangelogFormatError";
    this.line = line;
  }
}

/**
 * Rule 7: every bullet OPENS WITH THE PARTICIPLE OF WHAT WAS DONE.
 *
 * Before this rule a bullet was a bare noun phrase («Casilla en cada
 * categoría…»), which states that something exists but not whether it was
 * created, changed, fixed or removed — the one thing a reader of a version
 * wants to know first. The verb comes first so it can be read at a glance, in
 * the participle because a release note reports a fact already accomplished,
 * and because the participle is impersonal without «se» (the changelog never
 * addresses the reader).
 *
 * The vocabulary is CLOSED on purpose: an open one would let any first word
 * through and the rule would be decorative. It is stored as stems so that all
 * four agreements pass — «Añadido el…», «Añadida la…», «Añadidos los…»,
 * «Añadidas las…» — since the participle agrees with what follows. Extending
 * it is a deliberate edit here and in `docs/specs/versiones.md` §3.
 */
export const BULLET_PARTICIPLES = [
  "Añadido",
  "Ampliado",
  "Mejorado",
  "Cambiado",
  "Sustituido",
  "Reorganizado",
  "Unificado",
  "Separado",
  "Extraído",
  "Movido",
  "Renombrado",
  "Restringido",
  "Corregido",
  "Retirado",
] as const;

/** Stem + one of the four agreements, followed by a space: never a prefix of another word. */
const BULLET_OPENING = new RegExp(
  `^(?:${BULLET_PARTICIPLES.map((participle) => participle.slice(0, -1)).join("|")})(?:o|a|os|as) `,
);

const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;
const UNRELEASED_HEADING = `## [${UNRELEASED_LABEL}]`;
const SECTION_HEADING = /^### (.+)$/;
const BULLET = /^- (\S.*)$/;

/** Numeric comparison of `X.Y.Z`; string comparison would put 0.10.0 before 0.9.0. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** A real calendar day, not merely eight digits: 2026-02-30 is refused. */
function isCalendarDay(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

type OpenBlock = {
  kind: "unreleased" | "version";
  /** Line of the version heading, cited by ordering errors. */
  line: number;
  /** Line of the open section heading, cited when that section is empty. */
  sectionLine: number;
  version?: string;
  date?: string;
  sections: ChangelogSections;
  /** Section currently receiving bullets, and the order already seen. */
  current: Audience | null;
  seen: Audience[];
};

function closeSection(block: OpenBlock) {
  if (block.current && (block.sections[block.current]?.length ?? 0) === 0) {
    throw new ChangelogFormatError(block.sectionLine, `la sección «${block.current}» está vacía.`);
  }
}

function closeBlock(block: OpenBlock, changelog: Changelog) {
  closeSection(block);
  if (block.seen.length === 0) {
    throw new ChangelogFormatError(block.line, "la versión no tiene ninguna sección.");
  }
  if (block.kind === "unreleased") {
    changelog.unreleased = block.sections;
    return;
  }
  const previous = changelog.versions.at(-1);
  const version = block.version as string;
  const date = block.date as string;
  if (previous) {
    // Rule 3: strictly descending versions, non-increasing dates.
    if (compareVersions(version, previous.version) >= 0) {
      throw new ChangelogFormatError(block.line, `la versión ${version} debe ser menor que ${previous.version}, que la precede.`);
    }
    if (date > previous.date) {
      throw new ChangelogFormatError(block.line, `la fecha ${date} es posterior a la de ${previous.version} (${previous.date}).`);
    }
  }
  changelog.versions.push({ version, date, sections: block.sections });
}

/**
 * Parses the whole file or throws `ChangelogFormatError` on the first
 * violation of the grammar in `docs/specs/versiones.md` §3.
 */
export function parseChangelog(text: string): Changelog {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const changelog: Changelog = { unreleased: null, versions: [] };
  let block: OpenBlock | null = null;
  let preambleParagraphs = 0;
  let inParagraph = false;

  // Rule 0: the title opens the file.
  if (lines[0] !== "# Changelog") {
    throw new ChangelogFormatError(1, "el archivo debe abrir con «# Changelog».");
  }

  for (let index = 1; index < lines.length; index += 1) {
    const raw = lines[index];
    const lineNumber = index + 1;
    const line = raw.trimEnd();

    if (line === "") {
      inParagraph = false;
      continue;
    }

    if (line.startsWith("## ")) {
      if (block) closeBlock(block, changelog);
      if (line === UNRELEASED_HEADING) {
        // Rule 2: at most once, and always first.
        if (changelog.versions.length > 0 || changelog.unreleased) {
          throw new ChangelogFormatError(lineNumber, `«[${UNRELEASED_LABEL}]» solo puede aparecer una vez y antes de toda versión.`);
        }
        block = { kind: "unreleased", line: lineNumber, sections: {}, current: null, seen: [], sectionLine: lineNumber };
        continue;
      }
      const match = VERSION_HEADING.exec(line);
      if (!match) {
        throw new ChangelogFormatError(lineNumber, `encabezado de versión inválido: «${line}». Se espera «## [X.Y.Z] - AAAA-MM-DD» o «${UNRELEASED_HEADING}».`);
      }
      if (!isCalendarDay(match[2])) {
        throw new ChangelogFormatError(lineNumber, `la fecha ${match[2]} no es un día válido.`);
      }
      block = { kind: "version", line: lineNumber, version: match[1], date: match[2], sections: {}, current: null, seen: [], sectionLine: lineNumber };
      continue;
    }

    if (!block) {
      // Rule 0: before the first version, at most one paragraph of prose.
      if (line.startsWith("#") || line.startsWith("- ")) {
        throw new ChangelogFormatError(lineNumber, "antes de la primera versión solo se admite un párrafo de texto.");
      }
      if (!inParagraph) {
        preambleParagraphs += 1;
        inParagraph = true;
      }
      if (preambleParagraphs > 1) {
        throw new ChangelogFormatError(lineNumber, "antes de la primera versión solo se admite un párrafo de texto.");
      }
      continue;
    }

    const section = SECTION_HEADING.exec(line);
    if (section) {
      // Rule 4: only the three audiences, in order, without repeats.
      const audience = AUDIENCES.find((candidate) => candidate === section[1]);
      if (!audience) {
        throw new ChangelogFormatError(lineNumber, `sección desconocida «${section[1]}». Solo existen: ${AUDIENCES.join(", ")}.`);
      }
      const lastSeen = block.seen.at(-1);
      if (block.seen.includes(audience) || (lastSeen && AUDIENCES.indexOf(audience) < AUDIENCES.indexOf(lastSeen))) {
        throw new ChangelogFormatError(lineNumber, `la sección «${audience}» está repetida o fuera del orden ${AUDIENCES.join(" → ")}.`);
      }
      closeSection(block);
      block.seen.push(audience);
      block.current = audience;
      block.sections[audience] = [];
      block.sectionLine = lineNumber;
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet && block.current) {
      // Rule 7: the bullet says first what was done, from the closed vocabulary.
      if (!BULLET_OPENING.test(bullet[1])) {
        throw new ChangelogFormatError(
          lineNumber,
          `la viñeta debe empezar por el participio de lo que se hizo (${BULLET_PARTICIPLES.join(", ")}, en masculino o femenino, singular o plural): «${line}».`,
        );
      }
      (block.sections[block.current] as string[]).push(bullet[1]);
      continue;
    }

    // Rule 5: nothing but bullets inside a section.
    throw new ChangelogFormatError(
      lineNumber,
      block.current
        ? `dentro de una sección solo se admiten viñetas «- texto»: «${line}».`
        : `se esperaba una sección «### ${AUDIENCES.join("|")}»: «${line}».`,
    );
  }

  if (block) closeBlock(block, changelog);
  if (changelog.versions.length === 0 && !changelog.unreleased) {
    throw new ChangelogFormatError(lines.length, "el archivo no declara ninguna versión.");
  }
  return changelog;
}

/**
 * The version the platform runs: the highest RELEASED version. `[Sin
 * publicar]` is never the current version, whatever it contains.
 */
export function currentVersion(changelog: Changelog): string | null {
  return changelog.versions[0]?.version ?? null;
}

export type PublishOptions = {
  /** `X.Y.Z` to give the unreleased block. */
  version: string;
  /** Calendar day `AAAA-MM-DD` of the release. */
  date: string;
};

/**
 * Turns `[Sin publicar]` into a released version — spec §5.
 *
 * Pure: receives the file's text and returns the new text, or throws with the
 * reason. The heading is the only line that changes, so the notes are
 * released exactly as they were reviewed. The result is re-parsed before it
 * is returned, which applies every rule of §3 to it — including dates that
 * must not go backwards — so a release can never produce a file the build
 * would refuse.
 *
 * Unlike Impulsa there is no `--produccion` guard: Lopest's 1.0.0 already
 * describes what runs in production, so every release is a production one.
 *
 * The block is not re-created empty: an empty section is invalid (§3 rule 4).
 * The next unit of work opens `## [Sin publicar]` again above the newest
 * version.
 */
export function publishUnreleased(text: string, options: PublishOptions): string {
  if (!/^\d+\.\d+\.\d+$/.test(options.version)) {
    throw new Error(`«${options.version}» no es una versión X.Y.Z.`);
  }
  if (!isCalendarDay(options.date)) {
    throw new Error(`«${options.date}» no es un día AAAA-MM-DD válido.`);
  }
  const changelog = parseChangelog(text);
  if (!changelog.unreleased) {
    throw new Error(`no hay bloque «[${UNRELEASED_LABEL}]» que publicar.`);
  }
  const current = currentVersion(changelog);
  if (current && compareVersions(options.version, current) <= 0) {
    throw new Error(`la versión ${options.version} debe ser mayor que la vigente, ${current}.`);
  }
  const released = text.replace(UNRELEASED_HEADING, `## [${options.version}] - ${options.date}`);
  parseChangelog(released);
  return released;
}

/** A run of bullet text: plain, `code` or **bold** (rule 5). */
export type InlineToken = { kind: "text" | "code" | "strong"; value: string };

/**
 * Splits a bullet into the only two inline marks the contract interprets.
 * Everything else — links, HTML, underscores — stays literal text, and the
 * view renders every token as a text node, so a changelog line can never
 * inject markup into the page.
 */
export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) tokens.push({ kind: "text", value: text.slice(last, match.index) });
    tokens.push(match[1] !== undefined ? { kind: "code", value: match[1] } : { kind: "strong", value: match[2] });
    last = pattern.lastIndex;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}
