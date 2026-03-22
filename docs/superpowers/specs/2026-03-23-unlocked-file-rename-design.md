# Unlocked File Rename Pattern — Design Specification

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Change show/hide from in-place encryption toggle to file rename + gitignore safety layer

## Overview

Currently, `vars show` and `vars hide` modify a single file in-place, toggling between encrypted and decrypted states. The `# @vars-state locked/unlocked` header is the only signal preventing accidental commits of plaintext secrets.

This design adds a structural safety layer: unlocked files are **renamed** to `*.unlocked.vars`, and `*.unlocked.vars` is gitignored. The locked file (`*.vars`) is the only file that can be committed. Even if a developer forgets to run `vars hide`, plaintext secrets cannot reach git.

## File Naming Convention

Any `.vars` file gets a `.unlocked.vars` counterpart via string insertion before `.vars`:

| Locked (committed) | Unlocked (gitignored) |
|---|---|
| `config.vars` | `config.unlocked.vars` |
| `vars.vars` | `vars.unlocked.vars` |
| `shared/database.vars` | `shared/database.unlocked.vars` |

Only one file exists at a time — never both. The `# @vars-state` header is kept as a secondary signal, but the filename is the primary indicator of lock state.

## Show/Hide Flow

### `vars show [file]`

1. Resolve the target file. If an explicit path is given (e.g., `vars show config.vars`), check for the `.unlocked.vars` variant too — if only the unlocked variant exists, the file is already shown; print a message and exit.
2. If the `.unlocked.vars` file already exists (crash recovery or double-show), skip the rename and re-decrypt in-place from the existing `.unlocked.vars` file.
3. Prompt for PIN, decrypt master key.
4. `fs.renameSync("config.vars", "config.unlocked.vars")` (skipped if already at `.unlocked.vars`).
5. Read content from `config.unlocked.vars`.
6. Decrypt encrypted values in-place, update header to `# @vars-state unlocked`.
7. Write back to `config.unlocked.vars`.

### `vars hide`

1. Scan for all `*.unlocked.vars` files (filename glob, not header scan — faster than reading file content).
2. Prompt for PIN, decrypt master key.
3. For each `.unlocked.vars` file:
   a. Read content.
   b. Encrypt secret values, update header to `# @vars-state locked`. Already-encrypted values (`enc:v2:...`) are skipped (idempotent), making crash recovery safe — if a previous hide crashed after writing encrypted content but before renaming, re-running hide will not double-encrypt.
   c. Write encrypted content back to the `.unlocked.vars` file.
   d. `fs.renameSync("config.unlocked.vars", "config.vars")`.
   e. If a stale `config.vars` already exists (e.g., from a git checkout while unlocked), overwrite it — the `.unlocked.vars` version is the most recent state.

### `vars toggle [file]`

- If `config.vars` exists at the resolved path, run show.
- If `config.unlocked.vars` exists at the resolved path, run hide.

### Edge Cases

**Both files exist simultaneously:** Can happen if git restores `.vars` while `.unlocked.vars` is on disk, or if the user manually copies. Resolution: `.unlocked.vars` is treated as the most recent state. `vars hide` encrypts from `.unlocked.vars` and overwrites `.vars`. `vars doctor` warns about this state.

**`use "./foo.unlocked.vars"` in source:** This is a user error. The parser/validator should produce a warning: use statements should reference the canonical `.vars` name, not the unlocked variant.

### Crash Safety

**Show crash (after rename, before write):** File is at `config.unlocked.vars` with encrypted content. Header still says `# @vars-state locked`. Re-running `vars show` detects the `.unlocked.vars` file, skips the rename, and re-decrypts.

**Hide crash (after write, before rename):** File is at `config.unlocked.vars` with encrypted content and `# @vars-state locked` header. Re-running `vars hide` finds the `.unlocked.vars` file, the encryption step is idempotent (already-encrypted values are skipped), and the rename completes.

Both crash recovery paths are safe because: (1) encryption skips already-encrypted values, (2) the filename-based detection does not depend on the header, and (3) the operations are idempotent.

## File Resolution

All commands that read `.vars` files must find them regardless of lock state.

### `findVarsFile(dir)`

Updated to:
1. Look for `*.vars` files (excluding `*.unlocked.vars`)
2. Look for `*.unlocked.vars` files
3. Return whichever exists. If both somehow exist, prefer `.unlocked.vars` (most recent state)

### `findAllVarsFiles(dir)`

Same approach. Treats `config.vars` and `config.unlocked.vars` as the same logical file.

### `use` Resolution

When a file says `use "./shared/database.vars"`, the resolver:
1. Tries the literal path (`database.vars`).
2. If not found, tries the unlocked variant (`database.unlocked.vars`).
3. If neither exists, reports a resolution error.

The `use` statement always references the `.vars` name (the canonical name). The resolver transparently finds whichever exists on disk. A `use` statement referencing an `.unlocked.vars` path directly should produce a parser warning.

### Per-Command Behavior

| Command | Reads from either? | Notes |
|---|---|---|
| `vars gen` | Yes | Only needs structure/schemas |
| `vars run` | Yes | Has key, decrypts in-memory regardless |
| `vars check` | Yes | Has key for value checks |
| `vars export` | Yes | Has key |
| `vars ls` | Yes | Shows lock state from filename |
| `vars show` | Only `.vars` | That's what it unlocks |
| `vars hide` | Only `*.unlocked.vars` | That's what it locks |

## Safety Layers

Three layers prevent unlocked secrets from reaching git:

### Layer 1: Gitignore

`vars init` adds `*.unlocked.vars` to `.gitignore`. Even if the user forgets to hide, git will not track the file.

Updated `.gitignore` entries added by `vars init`:
```gitignore
# vars
.vars/key
.vars/key.*
*.unlocked.vars
```

### Layer 2: Pre-commit Hook (simplified)

The current hook scans file content for `@vars-state unlocked`. Updated to check if any `*.unlocked.vars` files are staged — a faster filename check instead of reading file content. Can also warn if any `.unlocked.vars` files exist in the working tree (even unstaged) as a reminder to hide before committing.

### Layer 3: State Header (secondary signal)

`# @vars-state locked/unlocked` stays in the file content. It is no longer the primary mechanism, but serves as:
- Human-readable signal when viewing the file
- Display indicator for `vars ls`
- Fallback if filename-based detection fails

## VS Code Extension

### Editor Title Buttons

Filename-based `when` clauses replace the runtime `setContext` approach:

- **Show button** (eye icon): `resourceLangId == vars && !(resourceFilename =~ /\.unlocked\.vars$/)`
  - Matches any `.vars` file that is NOT an `.unlocked.vars` file
- **Hide button** (eye-closed icon): `resourceLangId == vars && resourceFilename =~ /\.unlocked\.vars$/`

No runtime state tracking needed — pure declarative `when` clauses.

### Tab Following

`fs.renameSync` is followed natively by VS Code. The editor tab stays open and updates its title from `config.vars` to `config.unlocked.vars` (or vice versa). No close-tab/open-tab helpers needed.

### File Watcher

Already watches `**/*.vars` which matches both `*.vars` and `*.unlocked.vars`. Auto-regen on save works for either filename.

### Cleanup

The `updateVarsState` function and `setContext` calls added for the content-based approach are removed — filename-based `when` clauses handle everything declaratively.

## Scope of Changes

| File | Change |
|---|---|
| `packages/node/src/show-hide.ts` | `showFile`: rename then decrypt then write. `hideFile`: encrypt then write then rename |
| `packages/cli/src/commands/show.ts` | Find `.vars` file, call updated `showFile` |
| `packages/cli/src/commands/hide.ts` | Find `*.unlocked.vars` files instead of scanning headers |
| `packages/cli/src/commands/toggle.ts` | Detect state from filename existence |
| `packages/cli/src/commands/init.ts` | Add `*.unlocked.vars` to gitignore entries |
| `packages/cli/src/utils/context.ts` | `findVarsFile`/`findAllVarsFiles` resolve both patterns |
| `packages/node/src/use-resolver.ts` | Resolve `use` paths to whichever file exists on disk |
| `packages/vscode/package.json` | Filename-based `when` clauses for editor title buttons |
| `packages/vscode/src/extension.ts` | Remove `updateVarsState`/`setContext`, simplify to declarative approach |
| Pre-commit hook template in `init.ts` | Check for staged `*.unlocked.vars` files instead of scanning content |

### `vars ls` Display

When listing files, `vars ls` shows the canonical `.vars` name with a lock state indicator:

```
  config.vars          4 vars   unlocked
  shared/database.vars 6 vars   locked
```

The display always uses the canonical name regardless of which file exists on disk.

### Not Changed

`@vars/core` (parser, codegen, resolver) — the rename pattern is purely a file-layer concern. Core remains a pure computation engine with no filesystem awareness.

### v2 Design Doc Updates Required

The following sections of `2026-03-22-vars-v2-design.md` need updating after this change is implemented:

- **Section 3 (Encryption Model):** Add file rename as the primary safety mechanism; note that `# @vars-state` header is now a secondary signal.
- **Section 6 (CLI Commands):** Update `vars show` description from "in-place" to "rename + decrypt". Update `vars hide` from "scans for header" to "scans for `*.unlocked.vars` filenames".
- **Safety Layers subsection:** Add gitignore as the third safety layer.
- **Appendix B (File Layout):** Note the `*.unlocked.vars` pattern and its gitignore status.
