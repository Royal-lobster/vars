import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "diff",
    description: "Show differences between environments",
  },
  run() {
    console.log("vars diff — not yet implemented");
  },
});
