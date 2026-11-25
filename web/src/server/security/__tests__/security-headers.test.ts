import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SECURITY_HEADERS, securityHeaderRoutes } from "../security-headers";

const webRoot = path.resolve(__dirname, "../../../..");
const authoritySource = readFileSync(path.join(webRoot, "src/server/security/security-headers.ts"), "utf8");
const nextConfigSource = readFileSync(path.join(webRoot, "next.config.ts"), "utf8");

function header(name: string): string | undefined {
  return SECURITY_HEADERS.find((entry) => entry.key === name)?.value;
}

describe("security headers", () => {
  it("declares exactly the six expected headers", () => {
    expect(SECURITY_HEADERS.map((entry) => entry.key)).toEqual([
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
  });

  it("uses a one-year, withdrawable HSTS (no includeSubDomains, no preload)", () => {
    expect(header("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("ships the base CSP without restricting scripts or connections", () => {
    const directives = header("Content-Security-Policy")!.split("; ");
    expect(directives).toEqual([
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self' https://accounts.google.com",
    ]);
    expect(header("Content-Security-Policy")).not.toMatch(/script-src|connect-src|default-src/);
  });

  it("lets the NextAuth Google sign-in redirect chain pass form-action", () => {
    // POST /api/auth/signin/google answers 302 -> accounts.google.com.
    const formAction = header("Content-Security-Policy")!
      .split("; ")
      .find((directive) => directive.startsWith("form-action"))!;
    const sources = formAction.split(" ").slice(1);
    expect(sources).toContain("'self'");
    expect(sources).toContain("https://accounts.google.com");
  });

  it("denies framing, sniffing and unused powerful features", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
  });

  it("applies to every path", () => {
    expect(securityHeaderRoutes()).toEqual([{ source: "/:path*", headers: [...SECURITY_HEADERS] }]);
  });

  it("has no imports, so next.config.ts can load it", () => {
    expect(authoritySource).not.toMatch(/^\s*import\s/m);
  });

  it("is wired into next.config.ts with poweredByHeader disabled", () => {
    expect(nextConfigSource).toMatch(/from "\.\/src\/server\/security\/security-headers"/);
    expect(nextConfigSource).toMatch(/async headers\(\) \{\s*return securityHeaderRoutes\(\);\s*\}/);
    expect(nextConfigSource).toMatch(/poweredByHeader: false/);
  });
});
