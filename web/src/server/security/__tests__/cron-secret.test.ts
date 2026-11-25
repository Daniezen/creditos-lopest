import { describe, expect, it } from "vitest";

import { readBearerToken, secretsMatch } from "../cron-secret";

describe("secretsMatch", () => {
  it("accepts the exact secret", () => {
    expect(secretsMatch("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects a different secret, including different lengths", () => {
    expect(secretsMatch("s3cret-valuX", "s3cret-value")).toBe(false);
    expect(secretsMatch("s3cret", "s3cret-value")).toBe(false);
    expect(secretsMatch("s3cret-value-longer", "s3cret-value")).toBe(false);
  });

  it("fails closed when either side is missing or empty", () => {
    expect(secretsMatch("anything", undefined)).toBe(false);
    expect(secretsMatch("anything", "")).toBe(false);
    expect(secretsMatch(null, "s3cret-value")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch(undefined, undefined)).toBe(false);
  });
});

describe("readBearerToken", () => {
  it("extracts the token after the exact Bearer scheme", () => {
    expect(readBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("rejects missing headers and other schemes", () => {
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken("Basic abc123")).toBeNull();
    expect(readBearerToken("bearer abc123")).toBeNull();
    expect(readBearerToken("Bearerabc123")).toBeNull();
  });

  it("keeps the old exact-match contract end to end", () => {
    const expected = "s3cret";
    const check = (header: string | null) => secretsMatch(readBearerToken(header), expected);
    expect(check("Bearer s3cret")).toBe(true);
    expect(check("Bearer  s3cret")).toBe(false);
    expect(check("Bearer s3cret ")).toBe(false);
    expect(check("Bearer ")).toBe(false);
  });
});
