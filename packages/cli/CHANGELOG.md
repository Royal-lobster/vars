# dotvars

## 1.0.0

### Major Changes

- [#64](https://github.com/Royal-lobster/vars/pull/64) [`3a519a8`](https://github.com/Royal-lobster/vars/commit/3a519a852431fcfa0172c39ef5dcb08cef556a62) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Add `--platform serverless` runtime decrypt.

  Ciphertexts are now embedded in the generated `#vars` module and decrypted at runtime via `globalThis.crypto.subtle` using `env.VARS_KEY`. Works on Cloudflare Workers, Vercel Functions + Edge, Netlify Functions, Deno Deploy, Bun, and any runtime with Web Crypto (Node ≥19).

  **Breaking:**

  - `--platform cloudflare` was removed. Regenerate with `--platform serverless`.
  - `getVars` is now `async`: `const vars = await getVars(env)`.

  **Migration:**

  1. `wrangler secret put VARS_KEY` (or the Vercel / Netlify / Deno Deploy dashboard equivalent); set `VARS_ENV`.
  2. `vars gen config.vars --platform serverless`.
  3. Update call sites to `await getVars(env)`.
  4. Remove per-secret `wrangler secret put` / platform-dashboard entries now managed by `vars`.

### Patch Changes

- Updated dependencies [[`3a519a8`](https://github.com/Royal-lobster/vars/commit/3a519a852431fcfa0172c39ef5dcb08cef556a62)]:
  - @dotvars/core@1.0.0
  - @dotvars/node@0.5.0

## 0.4.2

### Patch Changes

- [#60](https://github.com/Royal-lobster/vars/pull/60) [`c95863a`](https://github.com/Royal-lobster/vars/commit/c95863a15b223cabe66764b200e4620ba5cb70ce) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Rename key file from `.vars/key` to `.varskey` and add pre-commit hook to block committing it

- [#63](https://github.com/Royal-lobster/vars/pull/63) [`b039b3d`](https://github.com/Royal-lobster/vars/commit/b039b3d9e30d311ce1f9d4b4511be7dd4cc2ba08) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Scope CLI commands to the nearest package in monorepos. `vars init` and other commands now resolve the project root by walking up to the nearest `package.json`, falling back to the git root. Previously, running `vars init` inside a monorepo subpackage (e.g. `/apps/backend`) would incorrectly write `.varskey`, edit `package.json`, and modify `.gitignore` at the repository root. The pre-commit hook continues to install at the git root since `.git/hooks` is repo-wide.

- Updated dependencies [[`c95863a`](https://github.com/Royal-lobster/vars/commit/c95863a15b223cabe66764b200e4620ba5cb70ce)]:
  - @dotvars/core@0.4.1
  - @dotvars/node@0.4.1

## 0.4.1

### Patch Changes

- [`4a6844a`](https://github.com/Royal-lobster/vars/commit/4a6844a81c30392bcac18a77fc52049bcfeb4f6b) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Remove `vars key fingerprint` subcommand

## 0.4.0

### Minor Changes

- [`d152c96`](https://github.com/Royal-lobster/vars/commit/d152c962fd6216f2456baf24095ab291015078e7) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Add multi-pin system with owner-scoped encryption. Owner PINs use HKDF-derived sub-keys for cryptographic isolation — each owner can only decrypt fields tagged with their name.

### Patch Changes

- Updated dependencies [[`d152c96`](https://github.com/Royal-lobster/vars/commit/d152c962fd6216f2456baf24095ab291015078e7)]:
  - @dotvars/core@0.4.0
  - @dotvars/node@0.4.0

## 0.3.1

### Patch Changes

- [`ada914a`](https://github.com/Royal-lobster/vars/commit/ada914af1aaa2ccf53352d329fe52db83eb94b12) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Add dotvars bin alias so npx dotvars works

## 0.3.0

### Minor Changes

- [`c1bb0ac`](https://github.com/Royal-lobster/vars/commit/c1bb0ac18b49cf368299239432d97f05a24ded9f) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Initial publish under dotvars namespace

### Patch Changes

- Updated dependencies [[`c1bb0ac`](https://github.com/Royal-lobster/vars/commit/c1bb0ac18b49cf368299239432d97f05a24ded9f)]:
  - @dotvars/core@0.3.0
  - @dotvars/node@0.3.0

## 0.2.0

### Minor Changes

- [#49](https://github.com/Royal-lobster/vars/pull/49) [`3906d2a`](https://github.com/Royal-lobster/vars/commit/3906d2a066d20faf221d45b1c1a1ec9f8f552f13) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Rename packages from @vars/_ to @dotvars/_ for npm publishing

### Patch Changes

- Updated dependencies [[`3906d2a`](https://github.com/Royal-lobster/vars/commit/3906d2a066d20faf221d45b1c1a1ec9f8f552f13)]:
  - @dotvars/core@0.2.0
  - @dotvars/node@0.2.0
