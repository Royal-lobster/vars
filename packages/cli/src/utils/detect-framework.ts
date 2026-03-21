import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface FrameworkInfo {
  name: string;
  package: string;
  configFile: string;
  snippet: string;
  devCommand: string;
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
        devCommand: "next dev",
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
        devCommand: "vite",
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
        devCommand: "astro dev",
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
      devCommand: "nuxt dev",
    };
  }

  // NestJS and SvelteKit require package.json inspection — read once
  const deps = readPackageJsonDeps(cwd);

  // NestJS (config file takes priority over package.json dep)
  if (existsSync(resolve(cwd, "nest-cli.json")) || "@nestjs/core" in deps) {
    return {
      name: "NestJS",
      package: "@vars/nestjs",
      configFile: "src/app.module.ts",
      snippet: SNIPPETS["NestJS"],
      devCommand: "nest start --watch",
    };
  }

  // SvelteKit
  if ("@sveltejs/kit" in deps) {
    return {
      name: "SvelteKit",
      package: "@vars/vite",
      configFile: "package.json",
      snippet: SNIPPETS["SvelteKit"],
      devCommand: "vite dev",
    };
  }

  return null;
}

/**
 * Auto-apply vars integration to the framework config file.
 * Returns true if the config was modified, false if it couldn't be auto-applied.
 * Falls back gracefully — if anything looks off, returns false so the user gets the snippet instead.
 */
export function applyFrameworkConfig(cwd: string, framework: FrameworkInfo): boolean {
  try {
    const configPath = resolve(cwd, framework.configFile);
    if (!existsSync(configPath)) return false;

    const content = readFileSync(configPath, "utf8");

    // Skip if already configured
    if (content.includes("@vars/")) return false;

    switch (framework.name) {
      case "Next.js":
        return applyNextConfig(configPath, content);
      case "Vite":
        return applyViteConfig(configPath, content);
      case "Astro":
        return applyAstroConfig(configPath, content);
      case "NestJS":
        return applyNestConfig(cwd, content);
      case "Nuxt":
        return applyNuxtConfig(configPath, content);
      case "SvelteKit":
        return applySvelteKitConfig(configPath, content);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function applyNextConfig(configPath: string, content: string): boolean {
  // Wrap the default export with withVars
  const importLine = 'import { withVars } from "@vars/next";\n';

  // Match: export default { ... } or export default nextConfig
  const defaultExportRe = /export\s+default\s+(?!withVars)/;
  if (!defaultExportRe.test(content)) return false;

  let result = content;

  // Add import after last import or at top
  const lastImportIdx = content.lastIndexOf("import ");
  if (lastImportIdx !== -1) {
    const lineEnd = content.indexOf("\n", lastImportIdx);
    result = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
  } else {
    result = importLine + content;
  }

  // Wrap: export default X → export default withVars(X)
  result = result.replace(
    /export\s+default\s+(?!withVars)([\s\S]*?);?\s*$/m,
    (match, configExpr) => {
      const trimmed = configExpr.replace(/;?\s*$/, "");
      return `export default withVars(${trimmed});\n`;
    },
  );

  writeFileSync(configPath, result);
  return true;
}

function applyViteConfig(configPath: string, content: string): boolean {
  const importLine = 'import { varsPlugin } from "@vars/vite";\n';

  // Find plugins array and add varsPlugin()
  if (!content.includes("plugins")) return false;

  let result = content;

  // Add import after last import
  const lastImportIdx = content.lastIndexOf("import ");
  if (lastImportIdx !== -1) {
    const lineEnd = content.indexOf("\n", lastImportIdx);
    result = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
  } else {
    result = importLine + content;
  }

  // Add varsPlugin() to start of plugins array
  result = result.replace(
    /plugins:\s*\[/,
    "plugins: [varsPlugin(), ",
  );

  writeFileSync(configPath, result);
  return true;
}

function applyAstroConfig(configPath: string, content: string): boolean {
  const importLine = 'import { varsIntegration } from "@vars/astro";\n';

  let result = content;

  // Add import after last import
  const lastImportIdx = content.lastIndexOf("import ");
  if (lastImportIdx !== -1) {
    const lineEnd = content.indexOf("\n", lastImportIdx);
    result = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
  } else {
    result = importLine + content;
  }

  if (content.includes("integrations")) {
    // Add to existing integrations array
    result = result.replace(
      /integrations:\s*\[/,
      "integrations: [varsIntegration(), ",
    );
  } else {
    // Add integrations to defineConfig
    result = result.replace(
      /defineConfig\(\{/,
      "defineConfig({\n  integrations: [varsIntegration()],",
    );
  }

  writeFileSync(configPath, result);
  return true;
}

function applyNestConfig(cwd: string, _content: string): boolean {
  // NestJS: modify src/app.module.ts
  const modulePath = resolve(cwd, "src", "app.module.ts");
  if (!existsSync(modulePath)) return false;

  const moduleContent = readFileSync(modulePath, "utf8");
  if (moduleContent.includes("@vars/")) return false;

  const importLine = 'import { VarsModule } from "@vars/nestjs";\n';

  let result = moduleContent;

  // Add import after last import
  const lastImportIdx = moduleContent.lastIndexOf("import ");
  if (lastImportIdx !== -1) {
    const lineEnd = moduleContent.indexOf("\n", lastImportIdx);
    result = moduleContent.slice(0, lineEnd + 1) + importLine + moduleContent.slice(lineEnd + 1);
  } else {
    result = importLine + moduleContent;
  }

  // Add to imports array
  if (result.includes("imports: [")) {
    result = result.replace(
      /imports:\s*\[/,
      "imports: [VarsModule.forRoot(), ",
    );
  } else {
    // Add imports array to @Module
    result = result.replace(
      /@Module\(\{/,
      "@Module({\n  imports: [VarsModule.forRoot()],",
    );
  }

  writeFileSync(modulePath, result);
  return true;
}

function applyNuxtConfig(configPath: string, content: string): boolean {
  const importLine = 'import { varsPlugin } from "@vars/vite";\n';

  let result = content;

  const lastImportIdx = content.lastIndexOf("import ");
  if (lastImportIdx !== -1) {
    const lineEnd = content.indexOf("\n", lastImportIdx);
    result = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
  } else {
    result = importLine + content;
  }

  if (content.includes("vite:")) {
    result = result.replace(
      /plugins:\s*\[/,
      "plugins: [varsPlugin(), ",
    );
  } else {
    result = result.replace(
      /defineNuxtConfig\(\{/,
      "defineNuxtConfig({\n  vite: { plugins: [varsPlugin()] },",
    );
  }

  writeFileSync(configPath, result);
  return true;
}

function applySvelteKitConfig(configPath: string, content: string): boolean {
  const importLine = 'import { varsPlugin } from "@vars/vite";\n';

  if (!content.includes("plugins")) return false;

  let result = content;

  const lastImportIdx = content.lastIndexOf("import ");
  if (lastImportIdx !== -1) {
    const lineEnd = content.indexOf("\n", lastImportIdx);
    result = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
  } else {
    result = importLine + content;
  }

  result = result.replace(
    /plugins:\s*\[/,
    "plugins: [varsPlugin(), ",
  );

  writeFileSync(configPath, result);
  return true;
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
