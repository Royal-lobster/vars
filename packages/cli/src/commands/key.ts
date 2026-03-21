import { defineCommand } from "citty";
import { requireKey } from "../utils/context.js";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "key",
    description: "Print the master key for CI/CD (e.g. Vercel, GitHub Actions)",
  },
  async run() {
    output.intro("key");

    const key = await requireKey();
    const base64Key = key.toString("base64");

    process.stdout.write(base64Key + "\n");

    output.outro("Set this as VARS_KEY in your CI/CD environment.");
  },
});
