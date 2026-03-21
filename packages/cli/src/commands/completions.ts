import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "completions",
    description: "Generate shell completions for bash/zsh/fish",
  },
  run() {
    console.log("vars completions — not yet implemented");
  },
});
