---
"dotvars": patch
---

Make credential precedence observable and align it with the documented contract: any PIN source now makes the encrypted envelope take precedence over ambient `VARS_KEY` (previously `VARS_KEY` silently won over ambient PINs), with `VARS_KEY` remaining a warned fallback when an ambient PIN fails to unlock the envelope. Explicit `--pin`/`--pin-file` failures always surface as errors. Non-interactive unlocks report their credential source on stderr, and `vars doctor` lists ambient credential sources, flagging `VARS_KEY`+PIN combinations and nudging `VARS_PIN` users toward `VARS_PIN_FILE`.
