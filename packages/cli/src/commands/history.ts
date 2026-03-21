import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "history",
    description: "Show full change history of a variable across environments",
  },
  run() {
    console.log("vars history — not yet implemented");
  },
});
