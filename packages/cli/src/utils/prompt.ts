import { consola } from "consola";

/**
 * Prompt the user for their PIN (hidden input).
 */
export async function promptPIN(message = "Enter PIN"): Promise<string> {
  const pin = await consola.prompt(message, {
    type: "text",
    placeholder: "PIN",
  });
  if (typeof pin !== "string" || pin.length === 0) {
    throw new Error("PIN is required");
  }
  return pin;
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
