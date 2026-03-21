import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "unlock",
    description: "Enter PIN to cache decrypted key in OS keychain",
  },
  run() {
    console.log("vars unlock — not yet implemented");
  },
});
