import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "template",
    description: "Generate a .env file from .vars (for Docker, legacy tools)",
  },
  run() {
    console.log("vars template — not yet implemented");
  },
});
