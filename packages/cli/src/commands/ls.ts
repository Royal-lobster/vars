import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "ls",
    description: "List all variables with environments, required/optional status, and metadata",
  },
  run() {
    console.log("vars ls — not yet implemented");
  },
});
