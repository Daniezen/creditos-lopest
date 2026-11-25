/**
 * Who reads which parts of the version history — `docs/specs/versiones.md` §4.
 *
 * Impulsa cuts its history by audience AND by the date each person's access
 * was enabled. Lopest has a handful of operators who have all used the
 * platform since its first production version, so only the audience cut is
 * ported: everyone reads every released version, and the `Técnico` section
 * plus the `[Sin publicar]` block are reserved to technical readers.
 *
 * Pure on purpose: the server resolves the reader (role) and this function
 * only applies the rule, so the rule is testable without a session.
 */
import { AUDIENCES, TECHNICAL_SECTION, type Audience, type Changelog, type ChangelogSections } from "./changelog-format";

export type VisibleVersion = {
  /** Null only for the `[Sin publicar]` node. */
  version: string | null;
  date: string | null;
  released: boolean;
  /** Only the sections this reader may read, in contract order. */
  sections: { audience: Audience; bullets: string[] }[];
};

export type VisibilityInput = {
  changelog: Changelog;
  /** Technical reader: sees `Técnico` sections and the unreleased block. */
  technical: boolean;
};

function filterSections(sections: ChangelogSections, technical: boolean) {
  return AUDIENCES.filter((audience) => (technical || audience !== TECHNICAL_SECTION) && sections[audience]?.length).map(
    (audience) => ({ audience, bullets: sections[audience] as string[] }),
  );
}

/**
 * The nodes one reader sees, newest first. A version with no section readable
 * by this reader (for example, a purely technical patch) produces no node, so
 * a non-technical reader never opens an empty version.
 */
export function selectVisibleVersions({ changelog, technical }: VisibilityInput): VisibleVersion[] {
  const nodes: VisibleVersion[] = [];
  if (technical && changelog.unreleased) {
    const sections = filterSections(changelog.unreleased, true);
    if (sections.length > 0) nodes.push({ version: null, date: null, released: false, sections });
  }
  for (const entry of changelog.versions) {
    const sections = filterSections(entry.sections, technical);
    if (sections.length > 0) nodes.push({ version: entry.version, date: entry.date, released: true, sections });
  }
  return nodes;
}

/**
 * `AAAA-MM-DD` as the interface writes a day: «2 de septiembre de 2026». The
 * day is a calendar fact, not an instant, so it is formatted in UTC to keep
 * the runtime's own time zone from moving it to the previous day.
 */
export function formatVersionDay(day: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}
