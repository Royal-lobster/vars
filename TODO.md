# vars v2 — Launch Checklist

## Before Launch

- [ ] **Test `vars init` in a real terminal** — full interactive flow: `vars init` → enter PIN → edit → `vars hide` → `vars run`. Nobody has tested this end-to-end in an actual TTY yet. 10 minutes of manual testing.
- [ ] **Publish to npm** — CLI is currently `pnpm link --global`. Need to publish `vars` to npm so `npm i -g vars` and `npx vars init` work for real users.

## Nice to Have (post-launch)

- [ ] **Vite plugin** (`@vars/vite`) — auto-bridge `process.env` → `import.meta.env` for client bundles
- [ ] **Monorepo guide** in docs — the `use` composition pattern with shared config across services
- [ ] **`vars add` non-interactive mode** — `vars add NAME --schema z.string() --dev "val" --prod "val"` for scripting/CI

## Known Edge Cases (tracked, not blocking)

- `vars run --env staging` with missing optional values silently passes (documented behavior)
- Sidebar framework icons inherit `currentColor` — brand colors only show on the cards page, not sidebar (cosmetic)
- `vars check` only validates envs that have values — doesn't warn about missing required values for undeclared envs

## Session Stats (2026-03-22)

- 8 PRs merged (#26–#33)
- 19 bugs found and fixed across 2 rounds of user testing
- 129 tests across `@vars/core` + `@vars/node`
- 6 framework test agents (Next.js, Express, Vite, Hono, SvelteKit, Turborepo monorepo)
- Ratings improved from 6/10 → 9/10
- Full docs site rewrite with per-framework pages + brand icons
