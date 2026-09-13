---
name: Generated client type libraries
description: TypeScript settings needed by Orval-generated browser clients in this workspace
---

The composite API client library must include `dom.iterable` alongside `dom` in its TypeScript `lib` list because generated header helpers call `Headers.entries()`.

**Why:** Codegen succeeds but the workspace typecheck fails without iterable DOM types, which can make a healthy generated client look broken.

**How to apply:** When adding or regenerating browser-facing API hooks, keep the client library's TypeScript `lib` setting aligned with the generated fetch helpers.