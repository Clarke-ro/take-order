---
name: Product media
description: Product image persistence and fallback behavior for Take Order
---

Product media uses a persisted public image URL with a generated visual fallback; browser-only uploads are not a substitute for persisted media.

**Why:** App Storage provisioning was unavailable in this workspace because available credits were exhausted, so a local upload would disappear across sessions and devices.

**How to apply:** Keep image URLs optional, validate them at the API boundary, show a live editor preview, and use the generated fallback wherever an item has no URL.