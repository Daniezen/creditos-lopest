/**
 * Single authority for the security headers every Lopest response carries.
 *
 * WHY THE APPLICATION AND NOT CADDY. These headers are part of the contract
 * between the application and the browser, so they travel versioned with the
 * code that depends on them: a policy change is a reviewed commit and cannot
 * drift because somebody edited the Caddyfile by hand on the VPS.
 *
 * WHO CONSUMES THIS. Only `next.config.ts`, through `headers()` with the source
 * `/:path*`. Next.js applies those headers in its routing phase, before the
 * proxy (`src/proxy.ts`) and before any page, route handler or static file is
 * served, so one declaration covers HTML pages, `/api/*` responses (including
 * the 401s and redirects the proxy itself produces), `/_next/static/*` and the
 * files in `public/`.
 *
 * This module must stay free of imports: `next.config.ts` loads it at build
 * and start time, outside the application's module graph and its aliases.
 */

/**
 * HSTS for one year, deliberately WITHOUT `includeSubDomains` and `preload`.
 *
 * The production host is an sslip.io name; `includeSubDomains` would bind
 * sibling names to HTTPS on the strength of this one app, and `preload` would
 * hard-code that into browsers in a way that takes months to undo. Without
 * them the header protects exactly this host and is withdrawn with
 * `max-age=0`.
 */
const STRICT_TRANSPORT_SECURITY = "max-age=31536000";

/**
 * Base Content-Security-Policy. It restricts framing, the document base,
 * plugins and form targets — directives that cannot break a working screen —
 * and on purpose says nothing about `script-src`, `connect-src` or
 * `default-src` (those need nonces and an origin inventory; if pursued they
 * should start as Report-Only).
 *
 * - `frame-ancestors 'none'`: nobody, this site included, may frame Lopest.
 *   Clickjacking defence; the app frames nothing of its own.
 * - `base-uri 'self'`: an injected `<base>` cannot re-point relative URLs.
 * - `object-src 'none'`: no `<object>`/`<embed>` plugins anywhere.
 * - `form-action 'self' https://accounts.google.com`: forms submit only to
 *   this origin. Browsers enforce `form-action` on the redirect chain that
 *   follows a form submission, and NextAuth's built-in sign-in page (served
 *   at `/api/auth/signin`, reachable even though `pages.signIn` points to
 *   `/login`) POSTs to `/api/auth/signin/google`, which answers with a 302 to
 *   accounts.google.com. Allowing that one origin keeps that path working.
 *   Our own `/login` does not depend on it: `signIn("google")` from
 *   `next-auth/react` POSTs with `fetch` and then navigates with
 *   `window.location`, which `form-action` does not govern. Google returns to
 *   `/api/auth/callback/google` with a GET (query response mode), and Server
 *   Actions post to the same origin.
 */
const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

/**
 * Only the origin leaves the site on cross-origin navigation; same-origin
 * requests keep the full URL (client and credit ids live in paths).
 */
const REFERRER_POLICY = "strict-origin-when-cross-origin";

/**
 * Powerful features no Lopest screen uses. An empty allowlist `()` means
 * "nobody", for the page and for any frame it might ever embed.
 */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
].join(", ");

/**
 * The six headers, by name. `X-Frame-Options: DENY` duplicates
 * `frame-ancestors 'none'` for browsers that predate CSP level 2; where both
 * are understood, `frame-ancestors` wins.
 */
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "Strict-Transport-Security", value: STRICT_TRANSPORT_SECURITY },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: REFERRER_POLICY },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
];

/** The `headers()` entry for `next.config.ts`: every path, every response. */
export function securityHeaderRoutes() {
  return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
}
