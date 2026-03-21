import { consola } from "consola";
import { createInterface } from "node:readline";

/**
 * Prompt the user for their PIN with hidden input.
 * Characters are masked with '*' to prevent shoulder-surfing.
 */
export async function promptPIN(message = "Enter PIN"): Promise<string> {
  // If not a TTY (piped input, CI), fall back to consola text prompt
  if (!process.stdin.isTTY) {
    const pin = await consola.prompt(message, {
      type: "text",
      placeholder: "PIN",
    });
    if (typeof pin !== "string" || pin.length === 0) {
      throw new Error("PIN is required");
    }
    return pin;
  }

  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Suppress echo
    process.stdin.setRawMode?.(true);

    process.stdout.write(`${message}: `);

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
          process.stdout.write("\b \b");
        }
      } else if (char === "\u0003") {
        // Ctrl+C
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener("data", onData);
        rl.close();
        process.exit(1);
      } else {
        pin += char;
        process.stdout.write("*");
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Prompt for confirmation (y/n).
 */
export async function promptConfirm(message: string): Promise<boolean> {
  const result = await consola.prompt(message, {
    type: "confirm",
  });
  return result === true;
}

/**
 * Prompt to select from a list of options.
 */
export async function promptSelect<T extends string>(
  message: string,
  options: T[],
): Promise<T> {
  const result = await consola.prompt(message, {
    type: "select",
    options: options.map((o) => ({ label: o, value: o })),
  });
  return result as T;
}

/**
 * Prompt for free text input.
 */
export async function promptText(
  message: string,
  options?: { placeholder?: string; default?: string },
): Promise<string> {
  const result = await consola.prompt(message, {
    type: "text",
    placeholder: options?.placeholder,
    default: options?.default,
  });
  if (typeof result !== "string") {
    throw new Error("Input is required");
  }
  return result;
}
