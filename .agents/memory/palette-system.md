---
name: Take Order palette system
description: The shared visual language for seller and buyer surfaces.
---

Use Ink Black (#111111), Paper White (#FFFFFF), Soul Teal (#13F2BA), and the light teal tint (#E6FFFA) as the only primary UI colors. Use Receipt Beige (#E8DCCF) only for an explicitly receipt-like outer surface.

**Why:** The product brand is intentionally restrained and recognizable across seller workspace, buyer checkout, and setup surfaces; platform-specific colors and legacy status colors weaken that consistency.

**How to apply:** Prefer the CSS theme variables and shared Button/StatusPill styles. Charts, connection tiles, product accents, and page-specific cards should use black, teal, white, gray neutrals, and permitted tints rather than hardcoded brand colors.