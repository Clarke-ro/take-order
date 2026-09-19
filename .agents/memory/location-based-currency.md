---
name: Location-based currency
description: How Take Order chooses and applies the currency shown across seller and buyer surfaces
---

Currency is suggested during seller onboarding from server-side country detection (Cloudflare country header first, geo-IP second), then Accept-Language/browser language only if location detection fails. The seller confirms and persists the currency; stored prices remain numeric amounts and are formatted, not converted.

**Why:** Device timezone is not a reliable currency signal, and currency must not change when a seller travels or signs in elsewhere. Changing symbols without exchange-rate data would also misrepresent stored prices, so currency changes affect metadata and formatting only.

**How to apply:** Keep the country-to-currency table complete and consistent between server detection and the client language fallback. Show the suggestion as editable onboarding input, persist the confirmed seller setting, and use the shared formatter for all monetary UI. Never use timezone or browser geolocation for currency inference.