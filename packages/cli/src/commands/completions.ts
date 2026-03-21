import { defineCommand } from "citty";

const COMMANDS = [
  "init", "add", "remove", "check", "gen",
  "unlock", "lock", "show", "hide", "toggle", "rotate",
  "push", "pull",
  "run", "status", "diff", "doctor", "hook", "ls", "template", "completions",
  "typecheck", "coverage", "blame", "history",
];

export default defineCommand({
  meta: {
    name: "completions",
    description: "Generate shell completions for bash/zsh/fish",
  },
  args: {
    shell: {
      type: "positional",
      description: "Shell: bash, zsh, or fish",
      required: true,
    },
  },
  run({ args }) {
    const shell = args.shell as string;
    const result = generateCompletions(shell);
    process.stdout.write(result);
  },
});

/**
 * Generate shell completion scripts.
 */
export function generateCompletions(shell: string): string {
  switch (shell) {
    case "bash":
      return generateBashCompletions();
    case "zsh":
      return generateZshCompletions();
    case "fish":
      return generateFishCompletions();
    default:
      throw new Error(
        `Unsupported shell: ${shell}. Supported: bash, zsh, fish`,
      );
  }
}

function generateBashCompletions(): string {
  return `# bash completions for vars
_vars_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${COMMANDS.join(" ")}"

  if [ "\${COMP_CWORD}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
  fi
}

complete -F _vars_completions vars
`;
}

function generateZshCompletions(): string {
  const commandList = COMMANDS.map((c) => `'${c}:${c} command'`).join("\n    ");
  return `#compdef vars
# zsh completions for vars

_vars() {
  local -a commands
  commands=(
    ${commandList}
  )
  _describe 'command' commands
}

compdef _vars vars
`;
}

function generateFishCompletions(): string {
  const lines = COMMANDS.map(
    (c) => `complete -c vars -n "__fish_use_subcommand" -a "${c}" -d "${c} command"`,
  );
  return `# fish completions for vars\n${lines.join("\n")}\n`;
}
