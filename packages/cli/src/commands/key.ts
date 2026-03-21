import { defineCommand } from "citty";
import { requireKey } from "../utils/context.js";

export default defineCommand({
  meta: {
    name: "key",
    description: "Print the master key for CI/CD (e.g. Vercel, GitHub Actions)",
  },
  async run() {
    const key = await requireKey();

    process.stdout.write(key.toString("base64") + "\n");

    // Chrome to stderr so piping works: vars key | pbcopy
    process.stderr.write("\nSet this as VARS_KEY in your CI/CD environment.\n");
  },
});
