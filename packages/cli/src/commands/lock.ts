import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "lock",
    description: "Clear decrypted key from OS keychain",
  },
  run() {
    console.log("vars lock — not yet implemented");
  },
});
