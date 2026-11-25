/**
 * Publishes the `[Sin publicar]` block as a version — docs/specs/versiones.md §5.
 *
 *   pnpm version:publicar 1.1.0
 *   pnpm version:publicar 1.1.0 --fecha 2026-12-01
 *
 * Rewrites a single line of web/CHANGELOG.md: the unreleased heading becomes
 * `## [X.Y.Z] - AAAA-MM-DD`. The transformation and every check live in
 * `publishUnreleased`, which is tested; this file only does the I/O.
 *
 * It does not commit, push, tag or deploy. The release is one commit of its
 * own, the annotated tag `vX.Y.Z` goes on that commit, and the VPS rebuild is
 * what makes the new version visible in the app.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { publishUnreleased } from "../../src/features/versiones/changelog-format.ts";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const version = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--fecha");
const dateFlag = args.indexOf("--fecha");

/** Today in Bogotá, the calendar in which version days are written. */
function bogotaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

try {
  if (!version) throw new Error("Falta la versión: pnpm version:publicar X.Y.Z [--fecha AAAA-MM-DD]");
  const date = dateFlag >= 0 ? args[dateFlag + 1] : bogotaToday();
  if (!date) throw new Error("--fecha necesita un día AAAA-MM-DD.");

  const changelogPath = `${webRoot}CHANGELOG.md`;
  const released = publishUnreleased(readFileSync(changelogPath, "utf8"), { version, date });
  writeFileSync(changelogPath, released);

  console.log(`Versión ${version} publicada con fecha ${date} en web/CHANGELOG.md.`);
  console.log(`Siguiente: git commit -m "chore(versiones): publicar la versión ${version}" y git tag -a v${version} -m "Versión ${version}".`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
