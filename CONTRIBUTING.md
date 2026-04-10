# Contributing

Thanks for contributing to `vars`.

## Repository Layout

This repo is a `pnpm` workspace with apps in `apps/` and published packages in `packages/`.

Current workspace layout:

- `apps/docs`: the docs site
- `packages/core`: parser, resolver, validation, and code generation logic
- `packages/node`: Node-specific runtime, crypto, key management, and file handling
- `packages/cli`: the `vars` / `dotvars` CLI
- `packages/lsp`: language server support for `.vars` files
- `packages/vscode`: the VS Code extension

If you are making a change, try to keep it scoped to the package or app that owns the behavior.

## Local Setup

Requirements:

- Node.js 20+
- pnpm 9+

Install dependencies:

```bash
pnpm install
```

## Tooling

- `pnpm` manages the workspace and runs scripts
- `turbo` orchestrates cross-package tasks like build, test, and typecheck
- `biome` handles formatting and linting
- `typescript` is used across the repo
- `vitest` is used in package test suites

Workspace definitions live in `pnpm-workspace.yaml`.
Task orchestration is configured in `turbo.json`.

## Common Commands

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm biome ci .
```

Useful local fix commands:

```bash
pnpm format:fix
pnpm lint:fix
```

If you only need to work in one package or app, you can run commands from that workspace directory as well.

## Contribution Notes

- Read `README.md` and the docs site first to understand the product surface.
- Keep changes focused. Small pull requests are easier to review and ship.
- Add or update tests when behavior changes.
- Run the relevant local checks before opening a pull request.

## Pull Request Guidelines

- Explain why the change is needed, not just what changed.
- Call out user-facing behavior changes.
- Include screenshots or terminal output when the change affects docs, CLI output, or editor behavior.
- Avoid unrelated refactors in the same pull request.

## Release Notes

This repo uses Changesets for releases. Add a changeset when your pull request changes published packages or user-visible behavior that should appear in release notes.

## Questions

For usage questions or bug reports, open a GitHub issue in this repository.
