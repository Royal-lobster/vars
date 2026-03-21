import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildContext, requireKey } from "../utils/context.js";
import { showVarsFile } from "./show.js";
import { hideVarsFile } from "./hide.js";
import * as output from "../utils/output.js";

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
    const ctx = buildContext({ file: args.file });
    const key = await requireKey();
    const decryptedPath = resolve(dirname(ctx.varsFilePath), "unlocked.vars");

    if (existsSync(decryptedPath)) {
      // Currently decrypted → hide it
      hideVarsFile(ctx.varsFilePath, key);
      output.success("Values encrypted → .vars/vault.vars restored.");
    } else {
      // Currently encrypted → show it
      showVarsFile(ctx.varsFilePath, key);
      output.success("Values decrypted → .vars/unlocked");
    }
  },
});
