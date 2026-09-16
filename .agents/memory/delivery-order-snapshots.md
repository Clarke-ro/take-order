---
name: Delivery order snapshots
description: Delivery settings captured on buyer links and finalized when the buyer submits checkout.
---

The seller’s flat delivery fee belongs to the buyer link as a snapshot, not to the buyer’s browser or current seller profile. A submitted order records pickup versus delivery and the address, and its final amount includes the fee only for delivery.

**Why:** Public checkout links can be opened on another device or browser, so relying on seller-local state would make the fee unavailable or change after the link was shared.

**How to apply:** Keep delivery configuration in the order contract and validate the selected method server-side. When handling repeat submissions, remove any previously applied delivery fee before calculating the new final amount so the fee cannot be doubled.