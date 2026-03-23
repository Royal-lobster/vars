import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** All known public-var prefixes across supported frameworks. Used as fallback when no framework is detected. */
export const ALL_PUBLIC_PREFIXES = [
  "NEXT_PUBLIC_",
  "VITE_",
  "NUXT_PUBLIC_",
  "PUBLIC_",
  "EXPO_PUBLIC_",
  "GATSBY_",
  "REACT_APP_",
];

export interface FrameworkInfo {
  name: string;
  devCommand: string;
  publicPrefixes: string[];
}

function readPackageJsonDeps(cwd: string): Record<string, string> {
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

export function detectFramework(cwd: string): FrameworkInfo | null {
  // Next.js
  const nextConfigs = ["next.config.js", "next.config.mjs", "next.config.ts"];
  for (const file of nextConfigs) {
    if (existsSync(resolve(cwd, file))) {
      return {
        name: "Next.js",
        devCommand: "next dev",
        publicPrefixes: ["NEXT_PUBLIC_"],
      };
    }
  }

  // Vite
  const viteConfigs = ["vite.config.js", "vite.config.ts"];
  for (const file of viteConfigs) {
    if (existsSync(resolve(cwd, file))) {
      return {
        name: "Vite",
        devCommand: "vite",
        publicPrefixes: ["VITE_"],
      };
    }
  }

  // Astro
  const astroConfigs = ["astro.config.mjs", "astro.config.ts"];
  for (const file of astroConfigs) {
    if (existsSync(resolve(cwd, file))) {
      return {
        name: "Astro",
        devCommand: "astro dev",
        publicPrefixes: ["PUBLIC_"],
      };
    }
  }

  // Nuxt
  if (existsSync(resolve(cwd, "nuxt.config.ts"))) {
    return {
      name: "Nuxt",
      devCommand: "nuxt dev",
      publicPrefixes: ["NUXT_PUBLIC_"],
    };
  }

  // NestJS and SvelteKit require package.json inspection — read once
  const deps = readPackageJsonDeps(cwd);

  // NestJS (config file takes priority over package.json dep)
  if (existsSync(resolve(cwd, "nest-cli.json")) || "@nestjs/core" in deps) {
    return {
      name: "NestJS",
      devCommand: "nest start --watch",
      publicPrefixes: [],
    };
  }

  // SvelteKit
  if ("@sveltejs/kit" in deps) {
    return {
      name: "SvelteKit",
      devCommand: "vite dev",
      publicPrefixes: ["PUBLIC_"],
    };
  }

  // Expo (React Native)
  if ("expo" in deps) {
    return {
      name: "Expo",
      devCommand: "expo start",
      publicPrefixes: ["EXPO_PUBLIC_"],
    };
  }

  // Gatsby
  if ("gatsby" in deps) {
    return {
      name: "Gatsby",
      devCommand: "gatsby develop",
      publicPrefixes: ["GATSBY_"],
    };
  }

  return null;
}

/**
 * Wrap the "dev" script in package.json with `vars run --env dev --`.
 * Reads the existing dev command and wraps it, avoiding recursive loops.
 */
export function wrapDevScript(cwd: string, framework: FrameworkInfo): boolean {
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) return false;

  try {
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw);

    if (!pkg.scripts?.dev) return false;

    const devScript: string = pkg.scripts.dev;

    // Already wrapped
    if (devScript.includes("vars run")) return true;

    // Wrap the existing command
    pkg.scripts.dev = `vars run --env dev -- ${devScript}`;

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}
