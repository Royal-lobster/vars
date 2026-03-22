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

1. Find the target `.vars` file (existing resolution logic)
2. Prompt for PIN, decrypt master key
3. `fs.renameSync("config.vars", "config.unlocked.vars")`
4. Read content from `config.unlocked.vars`
5. Decrypt encrypted values in-place, update header to `# @vars-state unlocked`
6. Write back to `config.unlocked.vars`

### `vars hide`

1. Scan for all `*.unlocked.vars` files (filename match, not header scan)
2. Prompt for PIN, decrypt master key
3. Read content from each `.unlocked.vars` file
4. Encrypt secret values, update header to `# @vars-state locked`
5. Write back to the `.unlocked.vars` file
6. `fs.renameSync("config.unlocked.vars", "config.vars")`

### `vars toggle [file]`

- If `config.vars` exists at the resolved path, run show
- If `config.unlocked.vars` exists at the resolved path, run hide

### Crash Safety

If the process dies between rename and write, the file exists at the new name but with stale content. The header still says the old state. Recovery: re-run the command. Since the file already has the target name, show/hide detects the state from the filename and re-processes.

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

When a file says `use "./shared/database.vars"`, the resolver checks for both `database.vars` and `database.unlocked.vars` at that path. The `use` statement always references the `.vars` name (the canonical name). The resolver transparently finds whichever exists on disk.

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

- **Show button** (eye icon): `resourceLangId == vars && resourceFilename =~ /^[^.]+\.vars$/`
  - Matches `config.vars` but not `config.unlocked.vars`
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

### Not Changed

`@vars/core` (parser, codegen, resolver) — the rename pattern is purely a file-layer concern. Core remains a pure computation engine with no filesystem awareness.
