---
"dotvars": patch
---

Scope CLI commands to the nearest package in monorepos. `vars init` and other commands now resolve the project root by walking up to the nearest `package.json`, falling back to the git root. Previously, running `vars init` inside a monorepo subpackage (e.g. `/apps/backend`) would incorrectly write `.varskey`, edit `package.json`, and modify `.gitignore` at the repository root. The pre-commit hook continues to install at the git root since `.git/hooks` is repo-wide.
