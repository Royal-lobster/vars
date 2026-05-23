# @dotvars/node

## 0.5.3

### Patch Changes

- Updated dependencies [[`d2dce9b`](https://github.com/Royal-lobster/vars/commit/d2dce9b9c699503963d118cd2014061e5e83de88)]:
  - @dotvars/core@1.0.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`7007c83`](https://github.com/Royal-lobster/vars/commit/7007c837e0332cd3d80e3140435df93a6edf64d2)]:
  - @dotvars/core@1.0.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`1658901`](https://github.com/Royal-lobster/vars/commit/1658901972b723dad28d8a6ad2bff223bd9d3df0)]:
  - @dotvars/core@1.0.1

## 0.5.0

### Minor Changes

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

## 0.4.1

### Patch Changes

- Updated dependencies [[`c95863a`](https://github.com/Royal-lobster/vars/commit/c95863a15b223cabe66764b200e4620ba5cb70ce)]:
  - @dotvars/core@0.4.1

## 0.4.0

### Minor Changes

- [`d152c96`](https://github.com/Royal-lobster/vars/commit/d152c962fd6216f2456baf24095ab291015078e7) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Add multi-pin system with owner-scoped encryption. Owner PINs use HKDF-derived sub-keys for cryptographic isolation — each owner can only decrypt fields tagged with their name.

### Patch Changes

- Updated dependencies [[`d152c96`](https://github.com/Royal-lobster/vars/commit/d152c962fd6216f2456baf24095ab291015078e7)]:
  - @dotvars/core@0.4.0

## 0.3.0

### Minor Changes

- [`c1bb0ac`](https://github.com/Royal-lobster/vars/commit/c1bb0ac18b49cf368299239432d97f05a24ded9f) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Initial publish under dotvars namespace

### Patch Changes

- Updated dependencies [[`c1bb0ac`](https://github.com/Royal-lobster/vars/commit/c1bb0ac18b49cf368299239432d97f05a24ded9f)]:
  - @dotvars/core@0.3.0

## 0.2.0

### Minor Changes

- [#49](https://github.com/Royal-lobster/vars/pull/49) [`3906d2a`](https://github.com/Royal-lobster/vars/commit/3906d2a066d20faf221d45b1c1a1ec9f8f552f13) Thanks [@Royal-lobster](https://github.com/Royal-lobster)! - Rename packages from @vars/_ to @dotvars/_ for npm publishing

### Patch Changes

- Updated dependencies [[`3906d2a`](https://github.com/Royal-lobster/vars/commit/3906d2a066d20faf221d45b1c1a1ec9f8f552f13)]:
  - @dotvars/core@0.2.0
