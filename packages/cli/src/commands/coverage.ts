import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "coverage",
    description: "Show % of variables with values set per environment",
  },
  run() {
    console.log("vars coverage — not yet implemented");
  },
});
