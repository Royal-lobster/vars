# Multi-PIN System Design

**Date:** 2026-03-30
**Status:** Draft

## Problem

Currently vars has a single master PIN that encrypts/decrypts all secret fields. Teams need scoped access: a backend team should only be able to decrypt backend secrets, not frontend secrets. The `owner` metadata field already exists in the parser but is purely informational.

## Design

### Key Hierarchy

One master key file (`.vars/key`). Owner sub-keys are derived deterministically from the master key using HKDF:

```
masterKey (random 256-bit, created at `vars init`)
  ├── HKDF(masterKey, "owner:backend-team")  → backendKey
  ├── HKDF(masterKey, "owner:frontend-team") → frontendKey
  └── ...
```

- **Master PIN** wraps the master key. Can derive any sub-key on the fly, decrypts everything.
- **Owner PIN** wraps only that owner's derived sub-key. Cryptographically scoped — cannot decrypt fields belonging to other owners or unowned fields.
- **Unowned fields** (no `owner` metadata) are encrypted with the master key. Only the master PIN can decrypt them.

### Key File Format

`.vars/key` becomes multi-line. Each line is a self-contained PIN-wrapped key entry:

```
pin:v1:aes256gcm:master:<salt>:<iv>:<ct>:<tag>
pin:v1:aes256gcm:owner=backend-team:<salt>:<iv>:<ct>:<tag>
pin:v1:aes256gcm:owner=frontend-team:<salt>:<iv>:<ct>:<tag>
```

The 4th segment (previously always positional salt) now carries scope metadata:
- `master` — wraps the master key
- `owner=<name>` — wraps a derived owner sub-key

Users can manually delete lines to create scoped key files for sharing (e.g., give the backend team a key file with only their `owner=backend-team` line).

### Ciphertext Format

Owner tag embedded in the encrypted token prefix:

```
# Master-encrypted (no owner)
enc:v2:aes256gcm-det:<iv>:<ct>:<tag>

# Owner-encrypted
enc:v2:aes256gcm-det:owner=backend-team:<iv>:<ct>:<tag>
```

This lets the CLI know before attempting decryption whether a field belongs to the current PIN holder. No trial-and-error decryption needed.

### `isEncrypted` and Parsing Updates

`crypto-constants.ts`:
- `isEncrypted()` remains unchanged (still checks `enc:v2:aes256gcm-det:` prefix)
- New helper: `parseEncryptedToken(raw)` returns `{ owner: string | null, iv, ct, tag }`
- New helper: `isOwnerEncrypted(raw, owner)` checks if a token belongs to a specific owner

`types.ts`:
- `EncryptedValue` gains an optional `owner?: string` field parsed from the token

### CLI: `vars pin create <owner>`

New subcommand under `vars pin`:

1. Requires interactive TTY
2. Prompts for master PIN
3. Decrypts master key
4. Derives owner sub-key: `HKDF(masterKey, "owner:<owner>")`
5. Prompts for new owner PIN (set + confirm)
6. Wraps owner sub-key with the new PIN using existing `encryptMasterKey()` (reused, key is just 32 bytes regardless)
7. Appends `pin:v1:aes256gcm:owner=<owner>:<salt>:<iv>:<ct>:<tag>` line to `.vars/key`
8. Re-encrypts all fields tagged `(owner = "<owner>")` across all `.vars` files:
   - Decrypt with master key
   - Re-encrypt with owner sub-key
   - Update ciphertext to include `owner=<owner>` in prefix
9. Outputs the generated PIN to the terminal

### CLI: Modified `requireKey()` → `requireKeyWithScope()`

The key resolution function changes to return both the key and its scope:

```typescript
interface KeyResult {
  key: Buffer;
  scope: "master" | { owner: string };
}
```

Resolution order:
1. `VARS_KEY` env var → master key, scope = `"master"`
2. Try each line in `.vars/key` against the provided PIN
   - If `master` line matches → derive any needed sub-keys on the fly, scope = `"master"`
   - If `owner=X` line matches → scope = `{ owner: "X" }`
3. If no line matches → "Invalid PIN"

### CLI: Modified `show` / `hide`

**`showFile(filePath, key, scope)`:**
- For each encrypted token in the file:
  - If scope is `"master"`: decrypt everything. For owner-tagged tokens, derive the sub-key from master. For untagged tokens, use master key directly.
  - If scope is `{ owner: "X" }`: only decrypt tokens tagged `owner=X`. Skip all others (leave as `enc:v2:...`).

**`hideFile(filePath, key, scope)`:**
- Walk the AST to determine each variable's owner from metadata
- For each quoted value to encrypt:
  - If scope is `"master"`: encrypt with appropriate key (owner sub-key if field has owner, master key if not). Tag ciphertext with owner if applicable.
  - If scope is `{ owner: "X" }`: only encrypt fields with `(owner = "X")`. Skip all others (leave quoted values as-is, leave other encrypted tokens untouched).

### HKDF Sub-Key Derivation

New function in `packages/node/src/crypto.ts`:

```typescript
import { hkdf } from "node:crypto";

export async function deriveOwnerKey(masterKey: Buffer, owner: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    hkdf("sha256", masterKey, "", `owner:${owner}`, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(Buffer.from(derivedKey));
    });
  });
}
```

- Hash: SHA-256
- Salt: empty (master key already has full entropy)
- Info: `"owner:<name>"` (the context string)
- Output: 32 bytes (AES-256 key)

### Encryption Context Changes

When encrypting with an owner key, the context string for deterministic IV derivation remains the same (`VAR_NAME@env`). The owner tag goes in the ciphertext prefix, not in the context.

The `encryptDeterministic` function gains an optional `owner` parameter:

```typescript
export function encryptDeterministic(
  plaintext: string,
  key: Buffer,
  context: string,
  owner?: string,
): string {
  const iv = deriveIV(key, context, plaintext);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ownerSegment = owner ? `owner=${owner}:` : "";
  return `enc:${VERSION}:${ALG_NAME}:${ownerSegment}${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}
```

The `decrypt` function parses the owner segment to find IV/CT/TAG at the correct positions.

### Key File Line Format

Updated format with scope segment:

```
pin:v1:aes256gcm:<scope>:<salt>:<iv>:<ct>:<tag>
```

Where `<scope>` is either `master` or `owner=<name>`.

Parsing logic: split on `:`, check `parts[3]`:
- If `"master"` → salt at `parts[4]`, rest follows
- If starts with `"owner="` → extract owner name, salt at `parts[4]`, rest follows

This is backwards-compatible: existing single-line key files have salt at `parts[3]`. The migration path: on first `vars pin create`, rewrite the existing line to `pin:v1:aes256gcm:master:<salt>:...` format.

### `vars pin` Subcommands

Only one subcommand: `vars pin create <owner>`.

No `export`, `list`, or `remove` commands. The key file is human-editable text — users can read it, delete lines, or copy lines manually.

### Environment Variable Behavior

- `VARS_KEY` (base64 master key): continues to work, always master scope. Decrypts everything.
- `VARS_PIN`: tries against all lines in key file. Scope determined by which line matches.

### Interaction with `vars key export`

`vars key export` currently outputs the base64 master key. This remains unchanged — it always exports the master key (requires master PIN). Owner PINs cannot export.

### Interaction with `vars rotate`

Key rotation with multi-pin: `vars rotate` requires master PIN. It generates a new master key, re-derives all owner sub-keys, re-encrypts everything, and re-wraps all entries in `.vars/key` with their existing PINs.

This is a future concern — `rotate` can be updated separately.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/crypto-constants.ts` | Add `parseEncryptedToken()`, `isOwnerEncrypted()` helpers |
| `packages/core/src/types.ts` | Add `owner?: string` to `EncryptedValue` |
| `packages/node/src/crypto.ts` | Add `deriveOwnerKey()`, add `owner` param to `encryptDeterministic()`, update `decrypt()` to handle owner prefix |
| `packages/node/src/key-manager.ts` | Add `encryptOwnerKey()` / `decryptOwnerKey()`, update format parsing for scope segment |
| `packages/node/src/show-hide.ts` | Accept scope in `showFile()` / `hideFile()`, owner-aware encrypt/decrypt logic |
| `packages/node/src/index.ts` | Export new functions |
| `packages/cli/src/commands/pin.ts` | New file: `vars pin create <owner>` command |
| `packages/cli/src/commands/key.ts` | Migrate existing key line to `master` scope on first multi-pin use |
| `packages/cli/src/utils/context.ts` | `requireKey()` → returns `KeyResult` with scope, tries all key file lines |

## Non-Goals

- No CLI command for exporting scoped key files (manual text editing)
- No CLI command for listing or removing PINs (read/edit the key file)
- No changes to `vars rotate` in this iteration
- No changes to codegen or resolver — they don't touch encryption
