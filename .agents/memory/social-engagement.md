---
name: Social engagement totals
description: Preserve the distinction between recorded zero engagement and missing social activity data.
---

Social engagement metrics must remain nullable until a connected source records them; aggregate known values, but do not turn an entirely unrecorded metric into zero.

**Why:** A zero is a meaningful connected-source result, while a missing value means the seller has no connected-account activity for that metric; manual imports are intentionally not part of the data model.

**How to apply:** Keep dashboard summaries and UI states explicit for null engagement values, and scope recorded totals to the active reporting window.