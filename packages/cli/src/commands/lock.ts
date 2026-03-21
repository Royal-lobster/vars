import { defineCommand } from "citty";
import { clearKey } from "@vars/core";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "lock",
    description: "Clear decrypted key from OS keychain",
  },
  async run() {
    await lockKey();
    output.success("Key cleared from OS keychain");
  },
});

export async function lockKey(): Promise<void> {
  await clearKey();
}
