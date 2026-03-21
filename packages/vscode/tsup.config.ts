import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["vscode"],
});
