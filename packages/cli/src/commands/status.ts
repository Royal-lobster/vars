import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "status",
    description: "Show current state: encrypted/decrypted, keychain, env, variable count",
  },
  run() {
    console.log("vars status — not yet implemented");
  },
});
