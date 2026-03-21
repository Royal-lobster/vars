import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "doctor",
    description: "Check for common issues (missing key, stale vars, expiring secrets)",
  },
  run() {
    console.log("vars doctor — not yet implemented");
  },
});
