import { TextDocument } from "vscode-languageserver-textdocument";
import {
  type CodeAction,
  CodeActionKind,
  type CodeActionParams,
  type CompletionItem,
  type Definition,
  type Hover,
  type InitializeParams,
  type InitializeResult,
  Location,
  ProposedFeatures,
  Range,
  type TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node.js";
import { type CodeActionContext, computeCodeActions } from "./code-actions.js";
import { type CompletionContext, computeCompletions } from "./completion.js";
import { type DefinitionContext, computeDefinition } from "./definition.js";
import { computeDiagnostics } from "./diagnostics.js";
import { type HoverContext, computeHover } from "./hover.js";

// Create connection using stdio transport
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [".", "("],
        resolveProvider: false,
      },
      hoverProvider: true,
      definitionProvider: true,
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.Refactor],
      },
    },
  };
});

// ─── Diagnostics (on document change, debounced) ────

const diagnosticTimers = new Map<string, ReturnType<typeof setTimeout>>();

documents.onDidChangeContent((change) => {
  const { uri } = change.document;

  // Clear any pending diagnostic run for this document
  const existing = diagnosticTimers.get(uri);
  if (existing) clearTimeout(existing);

  diagnosticTimers.set(
    uri,
    setTimeout(() => {
      diagnosticTimers.delete(uri);
      const doc = documents.get(uri);
      if (!doc) return;

      const rawDiagnostics = computeDiagnostics(doc.getText(), uri);
      connection.sendDiagnostics({ uri, diagnostics: rawDiagnostics });
    }, 250),
  );
});

// Clean up timers when documents close
documents.onDidClose((e) => {
  const timer = diagnosticTimers.get(e.document.uri);
  if (timer) {
    clearTimeout(timer);
    diagnosticTimers.delete(e.document.uri);
  }
});

// ─── Completion ─────────────────────────────────────

connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const ctx: CompletionContext = {
    text: document.getText(),
    line: params.position.line,
    character: params.position.character,
    uri: params.textDocument.uri,
  };

  return computeCompletions(ctx);
});

// ─── Hover ──────────────────────────────────────────

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const ctx: HoverContext = {
    text: document.getText(),
    line: params.position.line,
    character: params.position.character,
    uri: params.textDocument.uri,
  };

  const result = computeHover(ctx);
  if (!result) return null;

  return {
    contents: { kind: "markdown" as const, value: result.contents },
    range: result.range
      ? Range.create(
          result.range.startLine,
          result.range.startChar,
          result.range.endLine,
          result.range.endChar,
        )
      : undefined,
  };
});

// ─── Go to Definition ───────────────────────────────

connection.onDefinition((params: TextDocumentPositionParams): Definition | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const ctx: DefinitionContext = {
    text: document.getText(),
    line: params.position.line,
    character: params.position.character,
    uri: params.textDocument.uri,
  };

  const result = computeDefinition(ctx);
  if (!result) return null;

  return Location.create(
    result.targetUri,
    Range.create(
      result.targetRange.startLine,
      result.targetRange.startChar,
      result.targetRange.endLine,
      result.targetRange.endChar,
    ),
  );
});

// ─── Code Actions ───────────────────────────────────

connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const ctx: CodeActionContext = {
    text: document.getText(),
    startLine: params.range.start.line,
    endLine: params.range.end.line,
    uri: params.textDocument.uri,
  };

  const rawActions = computeCodeActions(ctx);

  return rawActions.map((action) => {
    const codeAction: CodeAction = {
      title: action.title,
      kind: action.kind.startsWith("quickfix") ? CodeActionKind.QuickFix : CodeActionKind.Refactor,
    };
    return codeAction;
  });
});

// Listen
documents.listen(connection);
connection.listen();
