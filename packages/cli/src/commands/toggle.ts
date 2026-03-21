import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildContext, requireKey } from "../utils/context.js";
import { countVariables } from "../utils/patterns.js";
import { showVarsFile, findProjectRoot, buildSafetyChecks } from "./show.js";
import { hideVarsFile } from "./hide.js";
import * as output from "../utils/output.js";
import * as clack from "@clack/prompts";
import pc from "picocolors";

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

      // Safety checks — same as vars show
      const projectRoot = findProjectRoot(dirname(ctx.varsFilePath));
      const checks = buildSafetyChecks(projectRoot);
      const failCount = checks.filter((c) => c.status !== "pass").length;

      if (failCount === 0) {
        clack.note(
          [
            "Edit .vars/unlocked.vars in your editor.",
            "",
            ...checks.map((c) => `${pc.green("\u2713")} ${c.label}`),
            "",
            "Run vars hide when you're done editing.",
          ].join("\n"),
          "Ready to edit",
        );
      } else if (failCount === checks.length) {
        clack.note(
          [
            "Edit .vars/unlocked.vars in your editor.",
            "",
            ...checks.map((c) =>
              c.status === "pass"
                ? `${pc.green("\u2713")} ${c.label}`
                : `${pc.yellow("\u26a0")} ${c.label}${c.fix ? `\n   ${pc.dim(c.fix)}` : ""}`,
            ),
            "",
            pc.yellow("Your decrypted secrets are exposed. Fix the above before continuing."),
          ].join("\n"),
          "Safety checks",
        );
      } else {
        clack.note(
          [
            "Edit .vars/unlocked.vars in your editor.",
            "",
            ...checks.map((c) =>
              c.status === "pass"
                ? `${pc.green("\u2713")} ${c.label}`
                : `${pc.red("\u2717")} ${c.label}${c.fix ? `\n   ${pc.dim(c.fix)}` : ""}`,
            ),
            "",
            "Remember to run vars hide when done \u2014 without the hook, there's no safety net.",
          ].join("\n"),
          "Safety checks",
        );
      }

      output.outro(
        `Toggled: locked \u2192 unlocked. ${varCount} variable${varCount !== 1 ? "s" : ""} decrypted.`,
      );
    }
  },
});
