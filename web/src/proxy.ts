import { NextResponse, type NextRequest } from "next/server";

// Relative on purpose: Vitest runs this file without the `@/` alias.
import { AUTH_COOKIE_NAMES } from "./server/auth/constants";

/**
 * Perimeter of the application (Next 16 `proxy` convention, formerly
 * `middleware.ts`; with a `src/` layout it must live at `src/proxy.ts`).
 *
 * **Default-deny.** Every path is private unless it appears in
 * `PUBLIC_PATHS` / `PUBLIC_FILES` below. A route added tomorrow is covered
 * before its author thinks about it; making something public is the single,
 * visible act of adding it to one of these lists.
 *
 * **What this gate does and does not prove.** It checks that a session cookie
 * is *present*, not that it is valid: it never reaches PostgreSQL. That is the
 * first of two layers. The strong check lives in server components, queries
 * and server actions (`requireUser()`, roles, per-client filters), which
 * decide whether the session belongs to an active user with permission.
 * Remove this layer and a page that forgot its guard becomes reachable;
 * remove the second and a forged cookie works.
 */

/**
 * Path prefixes reachable without a session, matched exactly or by whole
 * segment (`/login` and `/login/daniel.jpg` match, `/loginX` does not).
 *
 * - `/login`: the door itself, plus the profile photos in `public/login/`.
 * - `/api/auth`: NextAuth sign-in, callback, CSRF and session endpoints.
 * - `/api/cron`: called by n8n, authenticated by a shared secret compared in
 *   constant time inside each route (`server/security/cron-secret.ts`).
 * - `/api/salud`: health check for the platform, exposing nothing.
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/login",
  "/api/auth",
  "/api/cron",
  "/api/salud",
];

/**
 * Exact static files that must load without a session (browser icons
 * requested on the login screen). Exact matches only: nothing else in
 * `public/` becomes public by accident.
 */
export const PUBLIC_FILES: readonly string[] = ["/favicon.ico", "/apple-icon.png"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.includes(pathname)) return true;
  return PUBLIC_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasSessionCookie(request: NextRequest): boolean {
  return AUTH_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || hasSessionCookie(request)) {
    return NextResponse.next();
  }

  // An API caller gets a status it can act on instead of an HTML redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

/**
 * Only Next's own build assets are excluded; they carry no user data. Every
 * other path, including ones that do not exist yet, goes through the proxy.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
