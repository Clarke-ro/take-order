---
name: API contract codegen
description: Keep generated API package outputs synchronized before server validation.
---

Run the API spec codegen before trusting server typechecks after contract or analytics response changes.

**Why:** The workspace can resolve a package's checked-in dist declarations while the source-generated API files contain newer fields, producing misleading missing-export and response-shape errors.

**How to apply:** Use the api-spec codegen script, then run the root typecheck and the affected artifact tests.