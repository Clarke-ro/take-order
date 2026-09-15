---
name: Take Order typography system
description: The shared typeface choice for seller and buyer UI.
---

Use Inter for body copy, display headings, and numeric data values, including table values, to match the dashboard cards. Keep IBM Plex Mono only for compact utility labels, tracking labels, and intentionally technical IDs or metadata.

**Why:** The reference uses a neutral grotesk with tight, heavy headings; IBM Plex Mono on data values created a dotted-zero appearance that visibly conflicted with the dashboard card values.

**How to apply:** Change shared font variables and data-value rules rather than styling individual screens. Use tabular numerals with Inter for metrics and table values; reserve mono for labels, IDs, and metadata. Load the heading weights used by the app so bold display text does not fall back to synthetic weights.