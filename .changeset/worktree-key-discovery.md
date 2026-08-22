---
"dotvars": patch
---

Discover `.varskey` from linked git worktrees by falling back to the mirrored path in the primary checkout (the envelope is gitignored, so worktrees never receive it). `vars doctor` now reports the primary-checkout key and recommends `vars key import` instead of `vars key init` when locked files already exist. On headless Linux, the agent PIN dialog is skipped when no display server is available so the actionable `--pin-file` error surfaces immediately.
