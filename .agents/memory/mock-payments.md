---
name: Mock payment flow
description: Current buyer checkout behavior before a real payment provider is connected
---

Duka intentionally uses a labeled mock checkout for buyer payments. Pay collects test card details in the UI and then submits the existing payment intent endpoint; no provider, credential, or real charge is involved.

**Why:** The product needs an end-to-end checkout demonstration while provider selection and integration remain deferred.

**How to apply:** Keep demo copy explicit that no real payment is processed. Replace the mock step with provider-backed checkout and webhook-confirmed status transitions only when a payment integration is deliberately selected.