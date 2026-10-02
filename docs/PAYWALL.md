# Take Order Paywall & Subscription Architecture

This document outlines the commercial tier definitions, entitlement enforcement mechanics, subscription lifecycle state machine, and webhook synchronization across the Take Order application.

---

## 1. Commercial Tier Matrix

| Tier | Monthly Price | Annual Price | Active Order Links | Catalog Limit | Business Reports (`/reports/summary`) | CSV Analytics Export (`/dashboard/export`) | Channel Conversion Metrics |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Free** | $0 | $0 | **50 links** | Unlimited | ❌ Locked (`PRO_FEATURE_REQUIRED`) | ❌ Locked (`PRO_FEATURE_REQUIRED`) | ❌ Standard |
| **Pro Trial** | $0 (7 days) | N/A | **500 links** | Unlimited | ✅ Full Access | ✅ Full Access | ✅ Advanced |
| **Pro** | $12 / mo | $99 / yr | **500 links** | Unlimited | ✅ Full Access | ✅ Full Access | ✅ Advanced |
| **Pro+** | $29 / mo | $239 / yr | **Unlimited** (no ceiling) | Unlimited | ✅ Full Access | ✅ Full Access | ✅ Premium |

---

## 2. Subscription Lifecycle State Machine

```
              ┌───────────────────────────┐
              │   New Seller Registered   │
              └─────────────┬─────────────┘
                            │ (Auto-starts 7-day Pro Trial)
                            ▼
              ┌───────────────────────────┐
              │     Pro Trial Active      │
              └──────┬─────────────┬──────┘
                     │             │
        Trial Expires│             │ Subscribes via RevenueCat
        (No Card)    │             │
                     ▼             ▼
  ┌──────────────────────┐   ┌───────────────────────────┐
  │   Free Tier Active   │   │    Active (Pro / Pro+)    │
  │   (50 Link Limit)    │   └──────┬─────────────┬──────┘
  └──────────┬───────────┘          │             │
             │                      │ Payment     │ User Cancels
             │ Subscribes           │ Fails       │ (Stays active till period end)
             │                      ▼             ▼
             │               ┌──────────────┐ ┌──────────────────────┐
             │               │   Past Due   │ │  Pending Expiration  │
             │               └──────┬───────┘ └──────────┬───────────┘
             │                      │                    │
             │                      │ Grace Period       │ Period
             │                      │ Exhausted          │ Concludes
             │                      ▼                    ▼
             └──────────────►┌───────────────────────────┐
                             │    Graceful Downgrade     │
                             │     (Back to Free)        │
                             └───────────────────────────┘
```

### Critical Invariant: Downgrade Safety & Link Preservation
When a seller lapses or downgrades from Pro/Pro+ to Free:
1. **Existing Buyer Links NEVER Break**: Any link created while subscribed remains fully functional for buyers. Buyers can open `/o/:token`, view photos, pick variants, enter delivery details, and submit orders without hindrance.
2. **Quota Application**: The 50-link limit only applies when attempting to create *new* order links (`POST /api/orders`). If an existing seller has 85 orders, they are not deleted or disabled, but the seller cannot generate the 86th link until upgrading.

---

## 3. Webhook Synchronization (RevenueCat)

- **Endpoint**: `POST /api/webhooks/revenuecat`
- **Security**: Authenticated via HTTP `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH_TOKEN>`. Requests missing or with invalid tokens are rejected with `401 Unauthorized`.
- **Cache Invalidation**:
  Upon receiving valid event payloads (`INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`), the server immediately invalidates the in-memory cache for `appUserId` via `invalidateRevenueCatCache(appUserId)`.
- **Test Ping Handling**: Supports RevenueCat dashboard test pings (`type: "TEST"` or root webhook ping) with immediate `200 OK`.

---

## 4. Code Locations & Enforcement Points

### Server-Side Enforcement (Authoritative)
- **Central Resolver**: `artifacts/api-server/src/lib/entitlements.ts` (`resolveSellerEntitlement`, `checkRevenueCatSubscription`)
- **Link Quota Enforcement**: `artifacts/api-server/src/routes/orders.ts` (Validates active link count on `POST /api/orders`; blocks with `403` and `{ code: "LINK_LIMIT_REACHED" }`).
- **Reports Enforcement**: `artifacts/api-server/src/routes/analytics.ts` (`GET /api/reports/summary` blocks Free tier with `403` and `{ code: "PRO_FEATURE_REQUIRED" }`).
- **Export Enforcement**: `artifacts/api-server/src/routes/analytics.ts` (`GET /api/dashboard/export` blocks Free tier with `403` and `{ code: "PRO_FEATURE_REQUIRED" }`).

### Client-Side State & UI Gateways
- **SDK Wrapper**: `artifacts/duka/src/lib/revenuecat.ts` (RevenueCat Web Billing SDK initialization, package lookups, entitlement listeners).
- **React Hook**: `artifacts/duka/src/lib/entitlements.ts` (`useEntitlements`).
- **Contextual Upgrade Dialog**: `artifacts/duka/src/components/contextual-upgrade-dialog.tsx` (Triggered on link limits, report access, and export attempts).
- **Billing Management**: `artifacts/duka/src/pages/billing.tsx` (Plan status, restore purchases, customer portal redirection).
- **Checkout / Subscribe Flow**: `artifacts/duka/src/pages/subscribe.tsx` (Package cards, monthly/annual toggle, RevenueCat purchase execution).
