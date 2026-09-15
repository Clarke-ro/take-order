---
name: Dashboard picker browser checks
description: Browser-testing constraint for the dashboard's native date inputs and responsive picker overlay.
---

Chromium can expose multiple tab stops for a native `input[type="date"]`, one for each editable date segment, before moving to the next control.

**Why:** A tab-order test that assumes one stop per date input can stop before the calendar footer even though the UI is keyboard reachable.

**How to apply:** When checking the dashboard range picker with CDP, allow repeated date-field names and assert that calendar navigation, Close, and Apply are eventually reached in order at desktop and narrow widths.

Large root text settings can make native date inputs contribute a large intrinsic minimum width; let the custom range fields wrap and keep the calendar track explicitly shrinkable.

**Why:** At 200% root text, the date fields otherwise widened the calendar beyond its fixed menu even though the input itself had `min-width: 0`.

**How to apply:** Include an enlarged-text fixture in picker layout checks and preserve a text-scaled menu width/max-height rather than relying only on fixed pixel limits.