import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, isPublicPath, proxy } from "../proxy";
import { AUTH_COOKIE_NAMES } from "../server/auth/constants";

const ORIGIN = "https://lopest.example.test";

function request(pathname: string, withSession = false): NextRequest {
  const headers = new Headers();
  if (withSession) headers.set("cookie", `${AUTH_COOKIE_NAMES[0]}=any-token`);
  return new NextRequest(new URL(`${ORIGIN}${pathname}`), { headers });
}

/** `NextResponse.next()` marks pass-through with this internal header. */
function passesThrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/login/daniel.jpg",
    "/api/auth",
    "/api/auth/signin/google",
    "/api/auth/callback/google",
    "/api/cron/creditos/vencidas",
    "/api/cron/documentos/sincronizar",
    "/api/salud",
    "/favicon.ico",
    "/apple-icon.png",
  ])("treats %s as public", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/creditos",
    "/loginX",
    "/login-admin",
    "/api/authX",
    "/api/auth-bypass",
    "/api/cronjobs",
    "/api/saludable",
    "/api/clientes/123/documentos",
    "/api/creditos/exportar-resultados",
    "/favicon.ico/x",
    "/brand/lopest-logo.png",
  ])("treats %s as private", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("proxy", () => {
  it("lets public paths through without a session", () => {
    expect(passesThrough(proxy(request("/login")))).toBe(true);
    expect(passesThrough(proxy(request("/api/salud")))).toBe(true);
  });

  it("redirects an anonymous page request to /login", () => {
    const response = proxy(request("/creditos"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("does not let a look-alike prefix skip the gate", () => {
    const response = proxy(request("/loginX"));
    expect(response.status).toBe(307);
  });

  it("answers 401 to an anonymous private API call", async () => {
    const response = proxy(request("/api/creditos/exportar-resultados"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("lets a request with any recognised session cookie through", () => {
    for (const name of AUTH_COOKIE_NAMES) {
      const headers = new Headers({ cookie: `${name}=any-token` });
      const response = proxy(new NextRequest(new URL(`${ORIGIN}/creditos`), { headers }));
      expect(passesThrough(response)).toBe(true);
    }
  });

  it("ignores an empty session cookie", () => {
    const headers = new Headers({ cookie: `${AUTH_COOKIE_NAMES[0]}=` });
    const response = proxy(new NextRequest(new URL(`${ORIGIN}/creditos`), { headers }));
    expect(response.status).toBe(307);
  });

  it("covers every path except Next build assets", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/creditos")).toBe(true);
    expect(matcher.test("/api/cron/creditos/vencidas")).toBe(true);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(matcher.test("/_next/image")).toBe(false);
  });
});
