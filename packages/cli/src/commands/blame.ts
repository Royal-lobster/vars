import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "blame",
    description: "Show git history of who last changed a variable",
  },
  run() {
    console.log("vars blame — not yet implemented");
  },
});
