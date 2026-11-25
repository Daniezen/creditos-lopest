/**
 * Build gate for `web/CHANGELOG.md` — `docs/specs/versiones.md` §3 and §6.
 *
 * Runs before `next build` (the `build` script in web/package.json), so it
 * also runs inside the Docker `builder` stage: a malformed changelog stops the
 * image from being built instead of shipping a sidebar with no version. What
 * cannot be parsed is never deployed.
 *
 * It reads only one text file and needs no database, network or env, so it
 * cannot fail for reasons unrelated to the changelog itself.
 *
 * Plain Node, no bundler: Node 24 strips the types of the imported `.ts`
 * module, which is why that module is kept free of imports and of non-erasable
 * syntax. Unlike Impulsa there is no `package.json#version` check: Lopest
 * keeps the version in the changelog only, so there is a single source.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { currentVersion, parseChangelog } from "../../src/features/versiones/changelog-format.ts";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));

try {
  const changelog = parseChangelog(readFileSync(`${webRoot}CHANGELOG.md`, "utf8"));
  const newest = currentVersion(changelog);
  const pending = changelog.unreleased ? ", con bloque [Sin publicar]" : "";
  console.log(`CHANGELOG.md válido: ${changelog.versions.length} versiones publicadas, vigente ${newest ?? "ninguna"}${pending}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
