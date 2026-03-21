import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  Hover,
  Definition,
  Location,
  Range,
  CodeAction,
  CodeActionKind,
  TextEdit as LspTextEdit,
  TextDocumentPositionParams,
  CodeActionParams,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { computeDiagnostics } from "./diagnostics.js";
import { computeCompletions, type CompletionContext } from "./completion.js";
import { computeHover, type HoverContext } from "./hover.js";
import { computeDefinition, type DefinitionContext } from "./definition.js";
import {
  computeCodeActions as computeActions,
  type CodeActionContext as ActionContext,
} from "./code-actions.js";

// Create connection using stdio transport
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [".", "@"],
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

// ─── Diagnostics (on document change) ───────────────

documents.onDidChangeContent((change) => {
  const textDocument = change.document;
  const text = textDocument.getText();
  const rawDiagnostics = computeDiagnostics(text, textDocument.uri);

  connection.sendDiagnostics({
    uri: textDocument.uri,
    diagnostics: rawDiagnostics,
  });
});

// ─── Completion ─────────────────────────────────────

connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const ctx: CompletionContext = {
      text: document.getText(),
      line: params.position.line,
      character: params.position.character,
      uri: params.textDocument.uri,
    };

    return computeCompletions(ctx);
  },
);

// ─── Hover ──────────────────────────────────────────

connection.onHover(
  (params: TextDocumentPositionParams): Hover | null => {
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
      contents: {
        kind: "markdown",
        value: result.contents,
      },
      range: result.range
        ? Range.create(
            result.range.startLine,
            result.range.startChar,
            result.range.endLine,
            result.range.endChar,
          )
        : undefined,
    };
  },
);

// ─── Go to Definition ───────────────────────────────

connection.onDefinition(
  (params: TextDocumentPositionParams): Definition | null => {
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
  },
);

// ─── Code Actions ───────────────────────────────────

connection.onCodeAction(
  (params: CodeActionParams): CodeAction[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const ctx: ActionContext = {
      text: document.getText(),
      startLine: params.range.start.line,
      endLine: params.range.end.line,
      uri: params.textDocument.uri,
    };

    const rawActions = computeActions(ctx);

    return rawActions.map((action) => {
      const codeAction: CodeAction = {
        title: action.title,
        kind: action.kind.startsWith("quickfix")
          ? CodeActionKind.QuickFix
          : CodeActionKind.Refactor,
        edit: {
          changes: {
            [params.textDocument.uri]: action.edit.map((e) =>
              LspTextEdit.insert(
                { line: e.line, character: e.character },
                e.newText,
              ),
            ),
          },
        },
      };
      return codeAction;
    });
  },
);

// Listen
documents.listen(connection);
connection.listen();
