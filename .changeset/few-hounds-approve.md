---
"dotvars": patch
---

Load the decryption key lazily in `vars run` and `vars export` so plaintext-only configs no longer require `VARS_KEY` or PIN approval. This also adds focused coverage for plaintext env resolution and fixes the CLI prompt select typecheck issue.
