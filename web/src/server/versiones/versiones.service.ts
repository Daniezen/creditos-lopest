import { readFile } from "node:fs/promises";
import path from "node:path";

import { currentVersion, parseChangelog, type Changelog } from "@/features/versiones/changelog-format";
import { selectVisibleVersions, type VisibleVersion } from "@/features/versiones/version-visibility";
import { hasRole, type AppRole } from "@/server/auth/guards";

/**
 * Read side of Lopest's version history — `docs/specs/versiones.md`.
 *
 * `web/CHANGELOG.md` is the only source. It is read from disk once per
 * process: the Dockerfile copies it next to `server.js` in the runner image,
 * where `process.cwd()` is `/app`, and it cannot change while the process
 * lives, so re-reading it per request would only add I/O. The build already
 * refused a malformed file (`scripts/versiones/check-changelog.mjs`), so a
 * parse failure here means the image itself is broken.
 *
 * FAILURE IS CONTAINED, NOT HIDDEN. The version is metadata beside the work,
 * not the work: if the file is missing, every screen keeps working, the
 * version simply does not render, and the error goes to the container log
 * (`docker compose logs web`), where operation looks first.
 */

let changelogLoad: Promise<Changelog | null> | null = null;

function loadChangelog(): Promise<Changelog | null> {
  if (!changelogLoad) {
    changelogLoad = readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8")
      .then(parseChangelog)
      .catch((error: unknown) => {
        console.error("[versiones] CHANGELOG.md no se pudo leer:", error instanceof Error ? error.message : error);
        // Not memoized as a failure: the next caller tries again.
        changelogLoad = null;
        return null;
      });
  }
  return changelogLoad;
}

/** The version the platform runs, or null if the changelog could not be read. */
export async function getPlatformVersion(): Promise<string | null> {
  const changelog = await loadChangelog();
  return changelog ? currentVersion(changelog) : null;
}

/**
 * Technical readers see the `Técnico` sections and the unreleased block. The
 * decision uses `Role.code` on the server, as every authorization in Lopest.
 */
export function readsTechnicalNotes(user: { roles: AppRole[] }): boolean {
  return hasRole(user, "ADMIN");
}

export type VersionTimeline = {
  current: string | null;
  nodes: VisibleVersion[];
};

/**
 * The versions one user sees in `/novedades`. Filtering happens here, on the
 * server: sections the reader may not read never reach the browser.
 */
export async function getVersionTimeline(user: { roles: AppRole[] }): Promise<VersionTimeline> {
  const changelog = await loadChangelog();
  if (!changelog) return { current: null, nodes: [] };
  return {
    current: currentVersion(changelog),
    nodes: selectVisibleVersions({ changelog, technical: readsTechnicalNotes(user) }),
  };
}
