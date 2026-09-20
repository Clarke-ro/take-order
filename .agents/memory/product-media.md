---
name: Product media
description: Product image persistence and fallback behavior for Take Order
---

Product media uses a persisted image reference in the product text fields. New editor uploads are bounded PNG, JPEG, WebP, or GIF data URLs stored in PostgreSQL; existing public HTTP(S) URLs remain supported, with generated fallbacks when no image exists.

**Why:** The user explicitly selected database storage after App Storage was unavailable, so the product image must survive reloads and other sessions without relying on browser-only object URLs.

**How to apply:** Keep uploads limited to 2 MB at the UI, accept only the supported data-URL prefixes or legacy HTTP(S) URLs at the API boundary, allow request bodies large enough for base64 expansion, and show the live preview plus generated fallback behavior.

Public buyer-order responses must use the same data-URL-or-HTTP(S) image contract as product responses; a URL-only schema makes persisted uploads disappear or invalidates the preview response.

**Why:** Product images are copied into order items for the buyer link, so the public route must accept the same storage formats as the catalog route.

**How to apply:** Keep `PublicOrderItem.imageUrls` aligned with the product image pattern and regenerate the shared API schemas whenever the image contract changes.