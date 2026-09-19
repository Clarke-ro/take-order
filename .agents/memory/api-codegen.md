---
name: API contract codegen
description: Keep generated API package outputs synchronized before server validation.
---

Regenerate API specs and changed workspace package declarations before trusting server typechecks after contract, schema, or analytics response changes.

**Why:** The workspace can resolve checked-in dist declarations while source files contain newer fields, producing misleading missing-export and response-shape errors.

**How to apply:** Run the relevant package build/codegen (including `tsc --build` for changed declaration packages), then run the root typecheck and affected artifact tests. Keep nullable fields explicitly represented in server defaults when generated response schemas require them.