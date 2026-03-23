import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectFramework, ALL_PUBLIC_PREFIXES } from "../utils/detect-framework.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `vars-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("detectFramework", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects Next.js via next.config.js", () => {
    writeFileSync(join(tmp, "next.config.js"), "module.exports = {}");
    const fw = detectFramework(tmp);
    expect(fw).not.toBeNull();
    expect(fw!.name).toBe("Next.js");
    expect(fw!.publicPrefixes).toEqual(["NEXT_PUBLIC_"]);
  });

  it("detects Next.js via next.config.ts", () => {
    writeFileSync(join(tmp, "next.config.ts"), "export default {}");
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("Next.js");
  });

  it("detects Vite via vite.config.ts", () => {
    writeFileSync(join(tmp, "vite.config.ts"), "export default {}");
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("Vite");
    expect(fw!.publicPrefixes).toEqual(["VITE_"]);
  });

  it("detects Nuxt via nuxt.config.ts", () => {
    writeFileSync(join(tmp, "nuxt.config.ts"), "export default {}");
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("Nuxt");
    expect(fw!.publicPrefixes).toEqual(["NUXT_PUBLIC_"]);
  });

  it("detects Astro via astro.config.mjs", () => {
    writeFileSync(join(tmp, "astro.config.mjs"), "export default {}");
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("Astro");
    expect(fw!.publicPrefixes).toEqual(["PUBLIC_"]);
  });

  it("detects SvelteKit via svelte.config.js (even with vite.config.ts present)", () => {
    writeFileSync(join(tmp, "svelte.config.js"), "export default {}");
    writeFileSync(join(tmp, "vite.config.ts"), "export default {}");
    writeFileSync(join(tmp, "package.json"), JSON.stringify({
      dependencies: { "@sveltejs/kit": "^2.0.0" },
    }));
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("SvelteKit");
    expect(fw!.publicPrefixes).toEqual(["PUBLIC_"]);
  });

  it("detects SvelteKit via package.json dep (fallback without svelte.config)", () => {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({
      dependencies: { "@sveltejs/kit": "^2.0.0" },
    }));
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("SvelteKit");
    expect(fw!.publicPrefixes).toEqual(["PUBLIC_"]);
  });

  it("detects Expo via package.json dep", () => {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({
      dependencies: { expo: "^50.0.0" },
    }));
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("Expo");
    expect(fw!.publicPrefixes).toEqual(["EXPO_PUBLIC_"]);
  });

  it("detects Gatsby via package.json dep", () => {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({
      dependencies: { gatsby: "^5.0.0" },
    }));
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("Gatsby");
    expect(fw!.publicPrefixes).toEqual(["GATSBY_"]);
  });

  it("detects NestJS with empty publicPrefixes (server-side framework)", () => {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({
      dependencies: { "@nestjs/core": "^10.0.0" },
    }));
    const fw = detectFramework(tmp);
    expect(fw!.name).toBe("NestJS");
    expect(fw!.publicPrefixes).toEqual([]);
  });

  it("returns null when no framework detected", () => {
    writeFileSync(join(tmp, "package.json"), JSON.stringify({
      dependencies: { express: "^4.0.0" },
    }));
    const fw = detectFramework(tmp);
    expect(fw).toBeNull();
  });
});

describe("ALL_PUBLIC_PREFIXES", () => {
  it("contains all expected prefixes", () => {
    expect(ALL_PUBLIC_PREFIXES).toContain("NEXT_PUBLIC_");
    expect(ALL_PUBLIC_PREFIXES).toContain("VITE_");
    expect(ALL_PUBLIC_PREFIXES).toContain("NUXT_PUBLIC_");
    expect(ALL_PUBLIC_PREFIXES).toContain("PUBLIC_");
    expect(ALL_PUBLIC_PREFIXES).toContain("EXPO_PUBLIC_");
    expect(ALL_PUBLIC_PREFIXES).toContain("GATSBY_");
    expect(ALL_PUBLIC_PREFIXES).toContain("REACT_APP_");
  });
});
