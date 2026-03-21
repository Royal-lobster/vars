import { defineCommand } from "citty";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "unlock",
    description: "No longer needed — PIN is prompted on each command",
  },
  async run() {
    output.info("'vars unlock' is no longer needed — PIN is prompted on each command.");
  },
});
