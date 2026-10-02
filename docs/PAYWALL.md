# Take Order Paywall & Subscription Architecture

This document defines the commercial tier specifications, normalized subscription state machine, client hook consumption rules, and idempotent server enforcement across the Take Order application.

---

## 1. Commercial Tier Matrix

| Tier | Monthly Price | Annual Price | Active Order Links | Catalog Limit | Business Reports (`/reports/summary`) | CSV Analytics Export (`/dashboard/export`) | Channel Conversion Metrics |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Free** | $0 | $0 | **50 links** | Unlimited | ❌ Locked (`PRO_FEATURE_REQUIRED`) | ❌ Locked (`PRO_FEATURE_REQUIRED`) | ❌ Standard |
| **Pro Trial** | $0 (7 days) | N/A | **500 links** | Unlimited | ✅ Full Access | ✅ Full Access | ✅ Advanced |
| **Pro** | $9.99 / mo | $89.91 / yr | **500 links** | Unlimited | ✅ Full Access | ✅ Full Access | ✅ Advanced |
| **Pro+** | $20.00 / mo | $180.00 / yr | **Unlimited** (no ceiling) | Unlimited | ✅ Full Access | ✅ Full Access | ✅ Premium (Gold Tick) |

---

## 2. Canonical Subscription Lifecycle States

Every client component (Billing page, Subscribe page, Contextual upgrade dialogs, and Sidebar Pro card) reads from the single normalized `useSubscription()` hook. No component implements bespoke status conditions.

| Lifecycle State | Description | Primary CTA | Sidebar Card Display | Upgrade Path Shown |
| :--- | :--- | :--- | :--- | :--- |
| `trial_eligible` | Fresh account, has never started a trial | "Start 7-Day Free Trial" | "Start 7-day free trial" | Pro & Pro+ |
| `in_trial` | Active 7-day trial in progress | "Choose a Plan" (shows days left) | "{days} days left in trial" | Pro & Pro+ (no "Start trial") |
| `active` (Pro) | Active paid Pro tier | "Manage Subscription" | Hidden (or Pro badge) | Pro+ upgrade only |
| `active` (Pro+) | Active paid Pro+ tier | "Manage Subscription" | Hidden completely | None (highest tier) |
| `cancelled` | Subscribed, cancelled, but active until period end | "Resubscribe to Pro/Pro+" | "Access ends {date}" | Resubscribe / Restore |
| `billing_issue` | Payment failed or grace period | "Fix Payment Method" | "Payment issue" | Update payment method |
| `expired` | Trial ended or free tier after used trial | "Upgrade to Pro" | "Upgrade to Pro" | Pro & Pro+ (never trial) |

---

## 3. Server-Side Idempotency & Endpoint Guarantees

### Idempotent Trial Activation
- **Endpoint**: `POST /api/subscription/start-trial` (and alias `/api/entitlements/start-trial`)
- **Behavior**:
  - Checks `seller_settings.settings.trialStartedAt`.
  - If unset: sets `trialStartedAt = now.toISOString()`.
  - If already set: **idempotent** — returns existing trial without resetting or extending expiry.
  - Returns the complete normalized subscription state.

### Quota & Entitlement Enforcement
- **Central Resolver**: `artifacts/api-server/src/lib/entitlements.ts` (`resolveSellerEntitlement`)
- **Active Links Enforcement**: `artifacts/api-server/src/routes/orders.ts` blocks `POST /api/orders` when active link count meets tier limit with `403` and `{ code: "LINK_LIMIT_REACHED" }`.
- **Analytics & Reports Enforcement**: `artifacts/api-server/src/routes/analytics.ts` blocks Free tier from accessing full reports and CSV exports with `403` and `{ code: "PRO_FEATURE_REQUIRED" }`.

---

## 4. UI Design Rules for Subscription

1. **Strictly White Cards**:
   - Every card uses a pure white container (`bg-white dark:bg-neutral-900`, 1px border `border-[hsl(var(--card-border))]`, 12px radius).
   - Highlighting is achieved through a 2px black/accent border and a clean pill badge ("Most Popular" or "Unlimited").
   - **NO dark-filled cards anywhere in the app.**
2. **Zero-Flash Loading**:
   - Client caches subscription state in `sessionStorage` and `localStorage` (`takeorder_sub_{userId}`).
   - Sidebar card, billing page, and topbar load instantly without flashing during background re-validation.
