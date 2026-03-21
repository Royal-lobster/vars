# TUI UI/UX Redesign

## Problem

The vars CLI output is bland and uninviting. Instructions are walls of text that users skip. There's no step-by-step flow, no visual hierarchy, and critical UX gaps where state-changing commands don't explain what happened to the filesystem or what the user should do next.

Since vars replaces something as fundamental as .env files, the CLI must teach users the new mental model through its interface — not documentation they'll never read.

## Approach

**Clack + Custom Output Components** — Replace consola with `@clack/prompts` for interactive elements (prompts, spinners, intro/outro). Build a thin custom rendering layer on top of picocolors for domain-specific output (file trees, state transitions, safety checks, health reports). Remove consola entirely.

### Why clack

- Same aesthetic as Astro / SvelteKit CLIs — clean, minimal, lots of whitespace
- Lightweight — no React runtime like Ink
- Drop-in replacement for consola prompts — same async/await pattern
- picocolors stays (clack uses it internally)

## Shared Visual System

### New output components

All live in `packages/cli/src/utils/output.ts`, replacing the current consola-based implementation.

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| `intro(command)` | Command header with branding | `clack.intro()` |
| `outro(message)` | Clean exit message | `clack.outro()` |
| `step(message)` | Progress step in a flow | `clack.log.step()` |
| `fileTree(files)` | Show created/modified files with descriptions | Custom — picocolors + box-drawing chars |
| `stateChange(from, to)` | File swap visualization | Custom — arrow notation in clack log |
| `nextSteps(items)` | Actionable hints post-command | `clack.note()` with numbered list |
| `safetyChecks(checks)` | Pass/warn/fail safety status | `clack.note()` with colored icons |
| `warning(title, lines)` | Scannable warning block | `clack.log.warning()` with bullets |
| `healthCheck(groups)` | Doctor-style grouped checks | Custom — grouped with category headers |
| `table(rows)` | Styled data table | Custom — improved ASCII table with clack bar styling |

### Component API signatures

```typescript
interface FileTreeEntry {
  path: string;           // e.g. "vault.vars"
  description: string;    // e.g. "Encrypted secrets (commit this)"
  indent?: number;        // nesting depth, 0 = root
}

interface SafetyCheck {
  label: string;          // e.g. "unlocked.vars is gitignored"
  status: "pass" | "warn" | "fail";
  fix?: string;           // e.g. "Run: vars hook" — shown when status != pass
}

interface HealthCheckGroup {
  name: string;           // e.g. "Files", "Security", "Secrets Health"
  checks: Array<{
    label: string;
    status: "pass" | "warn" | "fail";
    message: string;
    suggestion?: string;  // actionable fix shown in summary box
  }>;
}

function intro(command: string): void;
function outro(message: string): void;
function step(message: string): void;
function fileTree(root: string, files: FileTreeEntry[]): void;
function stateChange(from: string, to: string): void;
function nextSteps(items: string[]): void;
function safetyChecks(checks: SafetyCheck[]): void;
function warning(title: string, bullets: string[]): void;
function healthCheck(groups: HealthCheckGroup[]): void;
function table(rows: Array<Record<string, string>>): void;
```

### Design rules

- **Mutating commands** (init, add, remove, show, hide, push, pull, rotate) get intro bar, step flow, outro bar
- **Read-only commands** (status, ls, check, diff, coverage, typecheck, blame, history) get heading + structured output, no ceremony
- **Dangerous commands** (push, rotate, delete .env) get a warning box before the action
- **Every state-changing command** clearly communicates what happened to the filesystem and what to do next

### Dependencies

- Add: `@clack/prompts`
- Remove: `consola`
- Keep: `picocolors`, `citty`

## Command Designs

### `vars init` — Onboarding

The first thing a new user sees. Must teach the mental model.

```
◆  vars init
│
│  Setting up encrypted environment variables.
│
◇  Choose a PIN
│  ••••••••
│
◇  Confirm PIN
│  ••••••••
│
▲  Your PIN is the only way to decrypt your secrets.
│  • No recovery mechanism — lose it, lose everything
│  • Store it in a password manager, team chat, or written down
│  • Keep it somewhere your coding agent can't access
│
●  Importing 12 variables from .env...
│
◇  Delete .env? (plaintext secrets are now encrypted)
│  Yes
│
◇  Install pre-commit hook? (blocks commits if secrets are decrypted)
│  Yes
│
│  Created:
│
│  .vars/
│  ├── vault.vars    Encrypted secrets (commit this)
│  ├── key           PIN-protected master key (gitignored)
│  └── unlocked.vars Only exists during editing (gitignored)
│
│  Also generates:
│  └── vars.generated.ts   Typed accessors, auto-regenerated
│
│  Safety:
│  ✓ .gitignore updated — key and unlocked.vars won't be committed
│  ✓ Pre-commit hook installed — blocks commits with decrypted secrets
│
│  Detected: Next.js
│  ┌  Add to next.config.mjs:
│  │  import { withVars } from "@vars/next";
│  │  export default withVars({ /* your config */ });
│  └  Run: pnpm add @vars/next
│
│  Workflow:
│  1. vars show   → decrypt (vault.vars → unlocked.vars)
│  2. Edit unlocked.vars
│  3. vars hide   → re-encrypt (unlocked.vars → vault.vars)
│
■  Ready! Run vars show to start editing.
```

#### Key design decisions

- **PIN warning moves AFTER entry** — you see it when it matters, not as a wall of text you skip before the prompt
- **File tree** shows what was created with one-line descriptions
- **Safety section** confirms gitignore and hook are set up
- **Framework detection** auto-detects from config files and shows integration snippet
- **Workflow section** teaches the mental model in 3 lines
- **Hook installation** offered as a prompt — most users want it

#### Framework detection

Check for config files to determine framework:

| File | Framework | Package |
|------|-----------|---------|
| `next.config.{js,mjs,ts}` | Next.js | `@vars/next` |
| `vite.config.{js,ts}` | Vite | `@vars/vite` |
| `astro.config.{mjs,ts}` | Astro | `@vars/astro` |
| `nuxt.config.ts` | Nuxt | `@vars/vite` |
| `nest-cli.json` or `@nestjs/core` in deps | NestJS | `@vars/nestjs` |
| SvelteKit (`@sveltejs/kit` in deps) | SvelteKit | `@vars/vite` |

If no framework detected, skip the section. If multiple detected (monorepo), use the first match in table order (Next.js > Vite > Astro > Nuxt > NestJS > SvelteKit).

#### PIN mismatch

If Choose PIN and Confirm PIN don't match, show an error and re-prompt both fields (don't exit).

### `vars show` — Unlock with Safety Reassurance

```
◆  vars show
│
◇  Enter PIN
│  ••••••••
│
●  Decrypting...
│
│  vault.vars → unlocked.vars
│
│  ╭──────────────────────────────────────────────────╮
│  │  Edit .vars/unlocked.vars in your editor.        │
│  │                                                  │
│  │  ✓ unlocked.vars is gitignored — won't be        │
│  │    committed accidentally                        │
│  │  ✓ Pre-commit hook active — auto-encrypts        │
│  │    before every commit as a fallback             │
│  │                                                  │
│  │  Run vars hide when you're done editing.         │
│  ╰──────────────────────────────────────────────────╯
│
■  Unlocked. 12 variables decrypted.
```

#### Safety check logic

Before showing the note box, check:

1. Is `.vars/unlocked.vars` in `.gitignore`?
2. Does the pre-commit hook exist (from `vars hook`)?

**Both pass** — green checkmarks, calming tone:

```
│  ✓ unlocked.vars is gitignored
│  ✓ Pre-commit hook active
```

**One fails** — warning with fix command:

```
│  ✓ unlocked.vars is gitignored
│  ✗ No pre-commit hook found
│    Run vars hook to install auto-encryption
│
│  Remember to run vars hide when done —
│  without the hook, there's no safety net.
```

**Both fail** — urgent tone:

```
│  ⚠ unlocked.vars is NOT gitignored
│    Run: echo '.vars/unlocked.vars' >> .gitignore
│  ⚠ No pre-commit hook found
│    Run: vars hook
│
│  Your decrypted secrets are exposed.
│  Fix the above before continuing.
```

### `vars hide` — Lock with Confirmation

```
◆  vars hide
│
◇  Enter PIN
│  ••••••••
│
●  Encrypting...
│
│  unlocked.vars → vault.vars
│  ╭──────────────────────────────────────────────────╮
│  │  Your changes are saved and encrypted.           │
│  │  vault.vars is safe to commit.                   │
│  ╰──────────────────────────────────────────────────╯
│
■  Locked. 12 variables encrypted.
```

### `vars toggle`

Same flow as show or hide depending on current state. Outro indicates direction:

```
■  Toggled: locked → unlocked. 12 variables decrypted.
```

or

```
■  Toggled: unlocked → locked. 12 variables encrypted.
```

### `vars doctor` — Grouped Health Checks

```
◆  vars doctor
│
│  Checking your vars setup...
│
│  Files
│  ✓ .vars/vault.vars found
│  ✓ .vars/key found
│  ✓ vars.generated.ts up to date
│
│  Security
│  ✓ .vars/key is gitignored
│  ✓ .vars/unlocked.vars is gitignored
│  ✓ Pre-commit hook installed
│  ✓ All values encrypted
│
│  Secrets Health
│  ⚠ STRIPE_KEY expires in 12 days (2026-04-02)
│  ⚠ OLD_API_TOKEN expired 30 days ago (2026-02-19)
│
│  ╭──────────────────────────────────────────────────╮
│  │  2 warnings                                      │
│  │                                                  │
│  │  → Rotate STRIPE_KEY before it expires           │
│  │  → Remove or update OLD_API_TOKEN                │
│  ╰──────────────────────────────────────────────────╯
│
■  6 passed · 2 warnings · 0 failures
```

All-green path:

```
◆  vars doctor
│
│  Checking your vars setup...
│
│  Files
│  ✓ .vars/vault.vars found
│  ✓ .vars/key found
│  ✓ vars.generated.ts up to date
│
│  Security
│  ✓ .vars/key is gitignored
│  ✓ .vars/unlocked.vars is gitignored
│  ✓ Pre-commit hook installed
│  ✓ All values encrypted
│
│  Secrets Health
│  ✓ No expiring or deprecated secrets
│
■  All checks passed!
```

#### Doctor check groups

| Group | Checks |
|-------|--------|
| Files | vault.vars exists, key exists, vars.generated.ts up to date |
| Security | key gitignored, unlocked.vars gitignored, pre-commit hook installed, all values encrypted |
| Secrets Health | Expiring secrets (< 30 days), expired secrets, deprecated variables |

### All Other Commands — Pattern Reference

#### Mutating commands (intro → steps → outro)

| Command | Intro | Steps | Outro |
|---------|-------|-------|-------|
| `add` | `◆ vars add` | PIN → spinner → step | `■ Added DATABASE_URL to vault.vars` |
| `remove` | `◆ vars remove` | Confirm → spinner | `■ Removed DATABASE_URL` |
| `rotate` | `◆ vars rotate` | PIN → spinner → safety box | `■ Rotated. New PIN is active.` |
| `push` | `◆ vars push` | PIN → platform → spinner → count | `■ Pushed 12 variables to Vercel (production)` |
| `pull` | `◆ vars pull` | Platform → spinner → diff | `■ Pulled 8 variables from Vercel` |
| `run` | `◆ vars run` | PIN → spinner | `■ Running: npm start (12 vars injected)` |
| `hook` | `◆ vars hook` | Detect husky/.git | `■ Pre-commit hook installed` |
| `gen` | `◆ vars gen` | Spinner | `■ Generated vars.generated.ts` |
| `template` | `◆ vars template` | Spinner → file path | `■ Generated .env from vault.vars` |

#### Read-only commands (structured data, no ceremony)

| Command | Output Style |
|---------|-------------|
| `status` | Clack note box — locked/unlocked state, env, variable count |
| `ls` | Improved table with clack vertical bar styling |
| `check` | Grouped validation output (errors and warnings categorized) |
| `diff` | Colored sections — same / different / only-in-env |
| `coverage` | Percentage per env with colored thresholds |
| `typecheck` | File references grouped with line numbers |
| `blame` / `history` | Styled log output |
| `completions` | No visual treatment — outputs shell script |

#### Deprecated commands (minimal treatment)

| Command | Output |
|---------|--------|
| `lock` | `clack.log.info("No longer needed — keys are never cached.")` |
| `unlock` | `clack.log.info("No longer needed — PIN is prompted on each command.")` |

## Files to Modify

| File | Change |
|------|--------|
| `packages/cli/package.json` | Add `@clack/prompts`, remove `consola` |
| `packages/cli/src/utils/output.ts` | Full rewrite — clack + custom components |
| `packages/cli/src/utils/prompt.ts` | Rewrite to use clack prompts (keep custom PIN logic for non-TTY) |
| `packages/cli/src/commands/init.ts` | Redesign flow — framework detection, hook prompt, file tree, workflow |
| `packages/cli/src/commands/show.ts` | Add safety checks, state change display, spinner |
| `packages/cli/src/commands/hide.ts` | Add state change display, spinner, confirmation box |
| `packages/cli/src/commands/toggle.ts` | Direction-aware outro |
| `packages/cli/src/commands/doctor.ts` | Grouped checks, actionable suggestions, summary line |
| All other command files | Migrate from `consola`/`output.*` to new output API |

## New file

| File | Purpose |
|------|---------|
| `packages/cli/src/utils/detect-framework.ts` | Framework detection logic for init |

## Non-TTY / CI Behavior

The current `prompt.ts` has explicit non-TTY handling (reading PIN from piped stdin for CI). This must be preserved. When `!process.stdin.isTTY`:

- Skip all clack interactive prompts (intro/outro bars, spinners)
- PIN reads from stdin pipe as before
- Output falls back to plain `console.log` without clack formatting
- `clack.isCancel()` checks must be added to all prompts to handle Ctrl+C gracefully

## Out of Scope

- Push/pull platform API integration (stubbed, designed but not implemented)
- Ink / React-based rendering
- Browser-based visual companion
