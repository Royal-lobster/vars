import { defineCommand } from "citty";
import { requireKey } from "../utils/context.js";
import * as clack from "@clack/prompts";

export default defineCommand({
  meta: {
    name: "key",
    description: "Print the master key for CI/CD (e.g. Vercel, GitHub Actions)",
  },
  async run() {
    // UI chrome goes to stderr so stdout is pipeable
    const showChrome = !!process.stderr.isTTY;
    if (showChrome) clack.intro("vars key");

    const key = await requireKey();

    process.stdout.write(key.toString("base64") + "\n");

    if (showChrome) clack.outro("Set this as VARS_KEY in your CI/CD environment.");
  },
});
