import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "run",
    description: "Decrypt in memory, inject into process.env, run command",
  },
  run() {
    console.log("vars run — not yet implemented");
  },
});
