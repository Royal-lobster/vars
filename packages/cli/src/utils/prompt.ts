import * as clack from "@clack/prompts";
import pc from "picocolors";
import { createInterface } from "node:readline";

/**
 * Prompt the user for their PIN with hidden input.
 * Characters are masked with '*' to prevent shoulder-surfing.
 *
 * Uses a custom raw-mode implementation (not clack) because clack's
 * password prompt doesn't support our specific masking / non-TTY needs.
 */
export async function promptPIN(message = "Enter PIN"): Promise<string> {
  // If not a TTY (piped input, CI, VS Code extension), read from stdin
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

  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Suppress echo
    process.stdin.setRawMode?.(true);

    // Use clack-style visual formatting
    process.stdout.write(`${pc.gray("\u25c6")}  ${message}: `);

    let pin = "";
    const onData = (chunk: Buffer) => {
      const char = chunk.toString();
      if (char === "\n" || char === "\r" || char === "\u0004") {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        if (pin.length === 0) {
          reject(new Error("PIN is required"));
        } else {
          resolve(pin);
        }
      } else if (char === "\u007F" || char === "\b") {
        // Backspace
        if (pin.length > 0) {
          pin = pin.slice(0, -1);
        }
      } else if (char === "\u0003") {
        // Ctrl+C
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener("data", onData);
        rl.close();
        clack.cancel("Operation cancelled.");
        process.exit(1);
      } else {
        pin += char;
      }
    };

    process.stdin.on("data", onData);
  });
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
