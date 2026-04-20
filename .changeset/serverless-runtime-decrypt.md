---
"@dotvars/core": major
"dotvars": major
"@dotvars/node": minor
---

Add `--platform serverless` runtime decrypt.

Ciphertexts are now embedded in the generated `#vars` module and decrypted at runtime via `globalThis.crypto.subtle` using `env.VARS_KEY`. Works on Cloudflare Workers, Vercel Functions + Edge, Netlify Functions, Deno Deploy, Bun, and any runtime with Web Crypto (Node ≥19).

**Breaking:**

- `--platform cloudflare` was removed. Regenerate with `--platform serverless`.
- `getVars` is now `async`: `const vars = await getVars(env)`.

**Migration:**

1. `wrangler secret put VARS_KEY` (or the Vercel / Netlify / Deno Deploy dashboard equivalent); set `VARS_ENV`.
2. `vars gen config.vars --platform serverless`.
3. Update call sites to `await getVars(env)`.
4. Remove per-secret `wrangler secret put` / platform-dashboard entries now managed by `vars`.
