import { describe, it, expect } from "vitest";
import { migrateFromEnv } from "../utils/migrate-from-env.js";

describe("migrateFromEnv", () => {
  it("marks NEXT_PUBLIC_ vars as public with default prefixes", () => {
    const env = `NEXT_PUBLIC_API_URL=https://api.example.com\nSECRET_KEY=abc123\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain('public NEXT_PUBLIC_API_URL = "https://api.example.com"');
    expect(result).toContain('SECRET_KEY = "abc123"');
    expect(result).not.toContain("public SECRET_KEY");
  });

  it("marks VITE_ vars as public with default prefixes", () => {
    const env = `VITE_APP_TITLE=My App\nDB_HOST=localhost\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain('public VITE_APP_TITLE = "My App"');
    expect(result).not.toContain("public DB_HOST");
  });

  it("marks NUXT_PUBLIC_ vars as public with default prefixes", () => {
    const env = `NUXT_PUBLIC_BASE_URL=https://example.com\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain('public NUXT_PUBLIC_BASE_URL = "https://example.com"');
  });

  it("marks EXPO_PUBLIC_ vars as public with default prefixes", () => {
    const env = `EXPO_PUBLIC_API_KEY=key123\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain('public EXPO_PUBLIC_API_KEY = "key123"');
  });

  it("marks GATSBY_ vars as public with default prefixes", () => {
    const env = `GATSBY_API_URL=https://gatsby.example.com\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain('public GATSBY_API_URL = "https://gatsby.example.com"');
  });

  it("marks REACT_APP_ vars as public with default prefixes", () => {
    const env = `REACT_APP_TITLE=CRA App\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain('public REACT_APP_TITLE = "CRA App"');
  });

  it("only marks framework-specific prefix when custom prefixes provided", () => {
    const env = `VITE_APP_TITLE=My App\nNEXT_PUBLIC_URL=https://example.com\nSECRET=abc\n`;
    // Simulate Vite-only detection
    const result = migrateFromEnv(env, ["VITE_"]);
    expect(result).toContain('public VITE_APP_TITLE = "My App"');
    // NEXT_PUBLIC_ should NOT be public when only VITE_ prefix is active
    expect(result).not.toContain("public NEXT_PUBLIC_URL");
    expect(result).toContain('NEXT_PUBLIC_URL = "https://example.com"');
  });

  it("marks nothing as public when empty prefix list provided", () => {
    const env = `NEXT_PUBLIC_URL=https://example.com\nVITE_KEY=abc\n`;
    const result = migrateFromEnv(env, []);
    expect(result).not.toContain("public ");
  });

  it("infers number types from unquoted numeric values", () => {
    const env = `PORT=3000\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain("PORT : z.number() = 3000");
  });

  it("infers boolean types from unquoted boolean values", () => {
    const env = `DEBUG=true\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain("DEBUG : z.boolean() = true");
  });

  it("combines public prefix with type inference", () => {
    const env = `NEXT_PUBLIC_PORT=8080\n`;
    const result = migrateFromEnv(env);
    expect(result).toContain("public NEXT_PUBLIC_PORT : z.number() = 8080");
  });
});
