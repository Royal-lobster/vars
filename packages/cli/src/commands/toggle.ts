import { defineCommand } from "citty";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildContext, requireKey } from "../utils/context.js";
import { showVarsFile } from "./show.js";
import { hideVarsFile } from "./hide.js";
import { ENV_VALUE_LINE } from "../utils/patterns.js";
import * as output from "../utils/output.js";
import * as clack from "@clack/prompts";

export default defineCommand({
  meta: {
    name: "toggle",
    description: "Flip between show/hide states",
  },
  args: {
    file: {
      type: "string",
      description: "Path to .vars file",
      alias: "f",
    },
  },
  async run({ args }) {
    output.intro("toggle");

    const ctx = buildContext({ file: args.file });
    const key = await requireKey(ctx);
    const decryptedPath = resolve(dirname(ctx.varsFilePath), "unlocked.vars");
    const isUnlocked = existsSync(decryptedPath);

    // Count variables before operation
    const sourcePath = isUnlocked ? decryptedPath : ctx.varsFilePath;
    const varCount = countVariables(sourcePath);

    const s = clack.spinner();

    if (isUnlocked) {
      // Currently decrypted -> hide it
      s.start("Encrypting...");
      hideVarsFile(ctx.varsFilePath, key);
      s.stop("Encrypted.");

      output.stateChange("unlocked.vars", "vault.vars");

      clack.note(
        [
          "Your changes are saved and encrypted.",
          "vault.vars is safe to commit.",
        ].join("\n"),
        "Locked",
      );

      output.outro(
        `Toggled: unlocked \u2192 locked. ${varCount} variable${varCount !== 1 ? "s" : ""} encrypted.`,
      );
    } else {
      // Currently encrypted -> show it
      s.start("Decrypting...");
      showVarsFile(ctx.varsFilePath, key);
      s.stop("Decrypted.");

      output.stateChange("vault.vars", "unlocked.vars");

      output.outro(
        `Toggled: locked \u2192 unlocked. ${varCount} variable${varCount !== 1 ? "s" : ""} decrypted.`,
      );
    }
  },
});

/**
 * Count the number of ENV_VALUE_LINE matches in a file.
 */
function countVariables(filePath: string): number {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  return lines.filter((line) => ENV_VALUE_LINE.test(line)).length;
}
