import { type CodeAction, CodeActionKind } from "vscode-languageserver/node.js";

export interface CodeActionContext {
  text: string;
  startLine: number;
  endLine: number;
  uri: string;
}

export interface TextEdit {
  line: number;
  character: number;
  newText: string;
}

export interface RawCodeAction {
  title: string;
  kind: string;
  edit: TextEdit[];
}

/**
 * Compute code actions for a selection range in a .vars document.
 * Minimal implementation — returns empty for now.
 */
export function computeCodeActions(_ctx: CodeActionContext): RawCodeAction[] {
  return [];
}
