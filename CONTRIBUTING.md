# Contributing

Thanks for contributing to `vars`.

## Before You Start

- Read the docs in `README.md` and the docs site to understand the product surface.
- Check existing issues and pull requests before starting duplicate work.
- Keep changes focused. Small, reviewable pull requests are easier to land.

## Local Setup

Requirements:

- Node.js 20+
- pnpm 9+

Install dependencies:

```bash
pnpm install
```

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

## Development Workflow

1. Create a branch for your change.
2. Make the smallest change that solves the problem.
3. Add or update tests when behavior changes.
4. Run the relevant checks locally before opening a pull request.
5. Open a pull request with a clear summary, rationale, and testing notes.

## Pull Request Guidelines

- Explain why the change is needed, not just what changed.
- Call out user-facing behavior changes.
- Include screenshots or terminal output when the change affects docs, CLI output, or editor behavior.
- Avoid unrelated refactors in the same pull request.

## Release Notes

This repo uses Changesets for releases. Add a changeset when your pull request changes published packages or user-visible behavior that should appear in release notes.

## Questions

For usage questions or bug reports, open a GitHub issue in this repository.
