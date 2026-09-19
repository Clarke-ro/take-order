---
name: Location-based currency
description: How Take Order chooses and applies the currency shown across seller and buyer surfaces
---

Currency display is selected once per browser session from the browser timezone when it maps to a known country, then from the browser locale region, with GHS as the fallback. Stored prices are numeric amounts and are formatted, not converted.

**Why:** The app had USD formatting in shared money helpers, a Ghana cedi prefix in product pricing, and dollar prefixes in order creation. Changing symbols without exchange-rate data would misrepresent stored prices, so consistency means one detected display currency rather than automatic conversion.

**How to apply:** Add new monetary UI through the shared currency formatter and symbol; do not introduce screen-specific currency literals or exchange-rate conversion unless the data model gains an explicit currency and conversion source.