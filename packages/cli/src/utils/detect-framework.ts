import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface FrameworkInfo {
  name: string;
  package: string;
  configFile: string;
  snippet: string;
}

const SNIPPETS: Record<string, string> = {
  "Next.js": `// next.config.mjs
import { withVars } from "@vars/next";

export default withVars({
  // your next config
});`,

  Vite: `// vite.config.ts
import { varsPlugin } from "@vars/vite";

export default defineConfig({
  plugins: [varsPlugin()],
});`,

  Astro: `// astro.config.mjs
import { varsIntegration } from "@vars/astro";

export default defineConfig({
  integrations: [varsIntegration()],
});`,

  Nuxt: `// nuxt.config.ts
import { varsPlugin } from "@vars/vite";

export default defineNuxtConfig({
  vite: { plugins: [varsPlugin()] },
});`,

  NestJS: `// app.module.ts
import { VarsModule } from "@vars/nestjs";

@Module({
  imports: [VarsModule.forRoot()],
})`,

  SvelteKit: `// vite.config.ts
import { varsPlugin } from "@vars/vite";

export default defineConfig({
  plugins: [sveltekit(), varsPlugin()],
});`,
};

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
        package: "@vars/next",
        configFile: file,
        snippet: SNIPPETS["Next.js"],
      };
    }
  }

  // Vite
  const viteConfigs = ["vite.config.js", "vite.config.ts"];
  for (const file of viteConfigs) {
    if (existsSync(resolve(cwd, file))) {
      return {
        name: "Vite",
        package: "@vars/vite",
        configFile: file,
        snippet: SNIPPETS["Vite"],
      };
    }
  }

  // Astro
  const astroConfigs = ["astro.config.mjs", "astro.config.ts"];
  for (const file of astroConfigs) {
    if (existsSync(resolve(cwd, file))) {
      return {
        name: "Astro",
        package: "@vars/astro",
        configFile: file,
        snippet: SNIPPETS["Astro"],
      };
    }
  }

  // Nuxt
  if (existsSync(resolve(cwd, "nuxt.config.ts"))) {
    return {
      name: "Nuxt",
      package: "@vars/vite",
      configFile: "nuxt.config.ts",
      snippet: SNIPPETS["Nuxt"],
    };
  }

  // NestJS and SvelteKit require package.json inspection — read once
  const deps = readPackageJsonDeps(cwd);

  // NestJS (config file takes priority over package.json dep)
  if (existsSync(resolve(cwd, "nest-cli.json")) || "@nestjs/core" in deps) {
    return {
      name: "NestJS",
      package: "@vars/nestjs",
      configFile: existsSync(resolve(cwd, "nest-cli.json"))
        ? "nest-cli.json"
        : "package.json",
      snippet: SNIPPETS["NestJS"],
    };
  }

  // SvelteKit
  if ("@sveltejs/kit" in deps) {
    return {
      name: "SvelteKit",
      package: "@vars/vite",
      configFile: "package.json",
      snippet: SNIPPETS["SvelteKit"],
    };
  }

  return null;
}
