import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "typecheck",
    description: "Scan codebase for process.env references not defined in .vars",
  },
  run() {
    console.log("vars typecheck — not yet implemented");
  },
});
