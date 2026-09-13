---
name: Dashboard financial semantics
description: Meaning of Duka's current financial analytics when operating expenses are not modeled
---

Until a separate expense ledger exists, dashboard expenses mean tracked product costs on paid or deposit-paid orders, profit means collected revenue minus those costs, and cash balance means that same net recorded cash—not a bank balance. Reports use a current snapshot rather than inventing monthly comparisons because the API has no historical period query or quantity field.

**Why:** Duka currently has catalog costs and order payments but no seller-entered expense entity, so presenting this as a full accounting balance would overstate what the data supports.

**How to apply:** Keep labels and helper text explicit about tracked product costs and current-snapshot limits; add a separate expense model and historical reporting query before presenting rent, ads, delivery, or monthly comparisons as complete financial reports.