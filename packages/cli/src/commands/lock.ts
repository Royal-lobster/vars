import { defineCommand } from "citty";
import * as output from "../utils/output.js";

export default defineCommand({
  meta: {
    name: "lock",
    description: "No longer needed — keys are never cached",
  },
  async run() {
    output.info("'vars lock' is no longer needed — keys are never cached.");
  },
});
