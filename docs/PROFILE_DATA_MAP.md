# Profile & Onboarding Data Architecture Map

This document establishes the single source of truth for all seller profile and onboarding data across Take Order. It defines the mapping from onboarding collection to local storage persistence, database persistence, and application consumption points.

---

## 1. Onboarding Funnel Steps & Data Schema

| Step | Screen Title | Collected Fields | Field Types & Constraints | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Step 0** | **Personal Details** | `firstName`<br>`lastName`<br>`phone`<br>`whatsappPhone`<br>`country`<br>`currency` | `string` (required)<br>`string` (required)<br>`string` (E.164 tel)<br>`string` (E.164 tel)<br>`string` (ISO country name)<br>`string` (ISO currency code: GHS, NGN, KES, ZAR, USD, GBP, EUR) | Owner identity, order notifications, base currency definition |
| **Step 1** | **Business Identity** | `businessName`<br>`category`<br>`description` | `string` (min 2 chars)<br>`string` (e.g. Fashion, Footwear)<br>`string` (generated: `${businessName} · ${category}`) | Storefront branding, buyer checkout heading, receipt headers |
| **Step 2** | **Sales Channels** | `channels` | `string[]` (e.g. `['whatsapp', 'instagram', 'tiktok', 'offline']`) | Channel attribution filter in Analytics, share links in Take an Order |
| **Step 3** | **Payout & Rails** | `payoutRails`<br>`momoNumber`<br>`momoProvider`<br>`bankAccount` | `object` / `string` (optional Mobile Money number, network, or bank details) | Buyer payment instructions on checkout and receipt |
| **Step 4** | **Setup Complete** | `onboardingComplete`<br>`completedAt` | `boolean` (`true`)<br>`string` (ISO timestamp) | Signals onboarding graduation, routing directly to `/dashboard` |

---

## 2. Storage & Persistence Architecture

```mermaid
flowchart TD
    A[Onboarding Wizard (UI)] -->|Reactive update| B[LocalStorage: duka-onboarding-profile]
    A -->|On Step 4 Finish| C[API Client: PATCH /api/seller/settings]
    C -->|Persist JSONB| D[(Postgres: seller_settings.settings)]
    C -->|Cache update| E[TanStack Query: getSellerSettings]
    B -->|Offline fallback| F[LocalStorage: duka-pending-settings-sync]
    F -->|When online| C
    E --> G[Settings Page]
    E --> H[Take an Order Page]
    E --> I[Analytics Page]
    E --> J[Sidebar & AppShell]
    E --> K[Buyer Storefront & Receipts]
```

### 2.1 Database Schema (`seller_settings` Table)

In `lib/db/src/schema/seller-settings.ts`:
```typescript
export const sellerSettingsTable = pgTable("seller_settings", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
});
```

### 2.2 JSONB Path Mapping (`seller_settings.settings`)

| Onboarding Field | Database JSONB Key | Type | Default Value | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `firstName` + `lastName` | `sellerName` | `string` | `"Store Owner"` | Combines first & last name |
| `businessName` | `businessName` | `string` | `"Take Order Store"` | Shown to buyers |
| `description` | `description` | `string` | `""` | Subtitle on checkout |
| `phone` / `whatsappPhone` | `organizationPhone` | `string` | `""` | Support phone for buyers |
| `country` | `country` | `string` | `"Ghana"` | Base location |
| `currency` | `currency` | `string` | `"GHS"` | Currency for all store orders |
| `channels` | `channels` | `string[]` | `['whatsapp', 'instagram']` | Active sales channels |
| `timezone` | `timezone` | `string` | `"UTC"` / derived | Date bucketing for analytics |

---

## 3. Application Consumption Matrix

| App Feature / Page | Consumed Profile Field | Source Hook / Store | Fallback Behavior |
| :--- | :--- | :--- | :--- |
| **Sidebar & AppShell** | `businessName`, `sellerName` | `useGetSellerSettings()` / `readSellerProfile()` | Displays "Take Order App" / "Store Owner" |
| **Take an Order** | `currency`, `organizationPhone`, `channels` | `useGetSellerSettings()` | Formats currency symbol (`GH₵`, `₦`, `$`); uses phone for dispatch share |
| **Analytics** | `currency`, `timezone`, `channels` | `useGetSellerSettings()` | Currency symbol on all 9 stat cards & charts; bucketing in seller timezone |
| **Add / Edit Item** | `currency`, `category` | `currencySymbol()`, `useGetSellerSettings()` | Selling and cost price currency prefixes; default category list |
| **Settings: Profile Tab** | `sellerName`, `businessName`, `organizationPhone`, `country` | `useGetSellerSettings()` | Populates editable form cards with 1-click save |
| **Settings: Store Tab** | `currency`, `channels`, `paymentInstructions` | `useGetSellerSettings()` | Currency lock protection modal if orders exist |
| **Order Details** | `currency`, `organizationPhone`, `businessName` | `useGetSellerSettings()` | Rider dispatch slip, WhatsApp share message, buyer receipt |
| **Buyer Checkout** | `businessName`, `currency`, `description`, `channels` | `useGetOrderPreview()` | Buyer sees seller business name, currency prices, and contact |

---

## 4. Single-Source-of-Truth Sync Rules

1. **Write Once, Propagate Everywhere**:
   - Updating any setting in `/settings` invalidates `getGetSellerSettingsQueryKey()`, which automatically refreshes Sidebar, Take an Order, Analytics, and Catalog.
2. **Offline-Resilient Queue**:
   - If an update occurs while offline, it is saved to `duka-pending-settings-sync` in `localStorage`.
   - The app's `useOnlineSync` hook detects network reconnection and flushes pending mutations to `PATCH /api/seller/settings`.
3. **Currency Immutability Protection**:
   - Once a seller has recorded orders, changing currency is blocked with a warning dialog to prevent silent historical balance corruption.
