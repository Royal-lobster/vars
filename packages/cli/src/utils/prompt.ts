import * as clack from "@clack/prompts";

/**
 * Prompt the user for their PIN with masked input.
 */
export async function promptPIN(message = "Enter PIN"): Promise<string> {
  // Non-TTY fallback (piped input, CI)
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => {
        const pin = data.trim().split("\n")[0];
        if (!pin) reject(new Error("PIN is required"));
        else resolve(pin);
      });
      process.stdin.resume();
    });
  }

  const result = await clack.password({
    message,
    mask: "*",
    validate: (value) => {
      if (!value) return "PIN is required";
    },
  });

  if (clack.isCancel(result)) {
    clack.cancel("Operation cancelled.");
    process.exit(1);
  }

  return result;
}

/**
 * Prompt for confirmation (y/n).
 */
export async function promptConfirm(message: string): Promise<boolean> {
  const result = await clack.confirm({ message });
  if (clack.isCancel(result)) {
    clack.cancel("Operation cancelled.");
    process.exit(1);
  }
  return result;
}

/**
 * Prompt to select from a list of options.
 */
export async function promptSelect<T extends string>(
  message: string,
  options: T[],
): Promise<T> {
  const result = await clack.select({
    message,
    options: options.map((o) => ({ value: o, label: o })),
  });
  if (clack.isCancel(result)) {
    clack.cancel("Operation cancelled.");
    process.exit(1);
  }
  return result as T;
}

/**
 * Prompt for free text input.
 */
export async function promptText(
  message: string,
  options?: { placeholder?: string; default?: string },
): Promise<string> {
  const result = await clack.text({
    message,
    placeholder: options?.placeholder,
    defaultValue: options?.default,
  });
  if (clack.isCancel(result)) {
    clack.cancel("Operation cancelled.");
    process.exit(1);
  }
  return result;
}
