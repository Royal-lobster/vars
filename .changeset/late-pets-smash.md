---
"dotvars": patch
"@dotvars/core": patch
---

Preserve existing generated platforms during `vars hide` by reusing the platform marker from sibling generated files, and improve hide-time regeneration handling so encryption continues across all unlocked files while surfacing regeneration failures at the end.
