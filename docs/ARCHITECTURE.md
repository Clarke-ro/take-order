# TAKE ORDER — ARCHITECTURE MAP

**Status**: Baseline (Pre-Launch Audit)  
**Date**: 2026-10-02  
**Branch**: `audit/hardening`

---

## 1. Monorepo Structure & Packages

Take Order is a pnpm monorepo consisting of client-facing applications, an API backend, shared schema/client libraries, and operations tooling.

```
takeorder/
├── artifacts/
│   ├── api-server/         # Express 5 REST API & Link Preview service (@workspace/api-server)
│   ├── duka/               # Vite + React 19 + Tailwind v4 Single Page App (@workspace/take-order)
│   └── mockup-sandbox/     # Static component testing sandbox (@workspace/mockup-sandbox)
├── lib/
│   ├── api-client-react/   # Generated TanStack React Query hooks + customFetch client (@workspace/api-client-react)
│   ├── api-spec/           # OpenAPI 3.1 specification + Orval generator config (@workspace/api-spec)
│   ├── api-zod/            # Generated Zod request/response validation schemas (@workspace/api-zod)
│   └── db/                 # Drizzle ORM schema, migrations, connection pool (@workspace/db)
├── scripts/                # Database seed, cleanup, and subscription simulation utilities (@workspace/scripts)
└── docs/                   # System documentation, audit log, paywall matrix, and hardening reports
```

### Application & Library Roles

| Package / Artifact | Type | Primary Responsibilities |
| :--- | :--- | :--- |
| `@workspace/take-order` (`artifacts/duka`) | Client (React 19 SPA) | Seller dashboard, order-link generator, catalog editor, public buyer checkout, client manager, and billing portals. |
| `@workspace/api-server` (`artifacts/api-server`) | Server (Node.js/Express) | Authentication bridging, REST API endpoints, crawler social link unfurling (`/o/:token`), RevenueCat webhooks, file upload to Supabase S3. |
| `@workspace/db` (`lib/db`) | Shared Library | Drizzle ORM PostgreSQL schema (`products`, `orders`, `order_items`, `expenses`, `seller_settings`), migration config. |
| `@workspace/api-spec` (`lib/api-spec`) | Specification | Single source of truth OpenAPI spec defining route contracts, status codes, and JSON schemas. |
| `@workspace/api-zod` (`lib/api-zod`) | Shared Library | Auto-generated Zod validators matching OpenAPI specs. |
| `@workspace/api-client-react` (`lib/api-client-react`) | Shared Library | Auto-generated React Query hooks and type-safe HTTP client (`customFetch`). |

---

## 2. Request Flows

### 2.1 Authenticated Seller Requests
```
Browser (Vite SPA)
  │
  ├─► Clerk Session Cookie / Bearer Token
  │
  ▼
API Gateway (Express)
  │
  ├─► CORS Origin Validator (corsOrigin)
  ├─► Helmet Security Headers
  ├─► Rate Limiting (/api/*)
  ├─► Clerk Proxy / clerkMiddleware
  │     └─ Resolves authenticated user ID (req.auth.userId)
  ├─► requireSellerAuth Middleware
  │     └─ Enforces active tenant ownership (res.locals.ownerUserId)
  ▼
Route Handlers (/api/products, /api/orders, etc.)
  │
  ├─► Input Validation (Zod schemas)
  ├─► Business Logic & Entitlement Quota Check (lib/entitlements.ts)
  ▼
Database Layer (Drizzle ORM)
  │
  └─► Parameterized PostgreSQL query strictly filtered by owner_user_id
```

### 2.2 Public Buyer Checkout Flow
```
Buyer Click / Chat Link (/o/:token)
  │
  ├── Crawler User-Agent (WhatsApp, Facebook, Twitter, Telegram)?
  │     ├── YES ─► API Server streams static HTML Open Graph tags (under 50ms)
  │     └── NO  ─► 302 Redirect to Frontend SPA (`https://usetakeorder.app/o/:token`)
  │
Buyer Submits Order
  │
  ▼
POST /api/public/orders/:token
  │
  ├─► IP Rate Limiter (100 req / 15 min)
  ├─► Database Transaction (serializable/read committed):
  │     ├─ Validate token & status == 'reserved'
  │     ├─ Persist buyer details, delivery method, deposit amount
  │     ├─ Transition status: 'reserved' -> 'deposit_paid' | 'paid' | 'pending'
  │     └─ Snapshot historical cost & decrement available stock
  ▼
200 OK + Updated Order Token
```

---

## 3. Authentication Flow

Take Order uses **Clerk** as the primary identity provider with support for development test-auth bypass.

1. **Client Identity**:
   - `ClerkProvider` wraps the app in production (`CLERK_PUBLISHABLE_KEY`).
   - If `CLERK_PUBLISHABLE_KEY` is absent or `duka-test-auth` is set, `AuthContext` provides a deterministic mocked identity (`test-seller-id`) for automated testing and isolated sandbox verification.
2. **Server Verification**:
   - `clerkMiddleware` inspects incoming HTTP Authorization headers or cookies.
   - `requireSellerAuth` extracts `req.auth?.userId`. If null or unauthenticated, it returns HTTP 401 Unauthorized.
   - For dev/test mode, the server recognizes `x-test-user-id` header only when explicitly enabled via non-production environment flag.
3. **Tenant Isolation**:
   - Every database query for seller data joins or filters on `ownerUserId = req.auth.userId`.
   - Sellers cannot read, modify, or delete resources belonging to any other `ownerUserId`.

---

## 4. Subscription & Entitlements Flow

Take Order uses **RevenueCat** (with Web Billing & Paddle gateway) to manage seller subscriptions.

```
Seller in SPA
  │
  ├─► RevenueCat Purchases SDK (Web Billing)
  │     └─ Initializes with Public Key (VITE_RC_API_KEY)
  ├─► Checks Entitlement: `take_order_app_pro` or `take_order_app_pro_plus`
  │
Purchase / Renewal / Cancellation Event
  │
  ▼
RevenueCat Webhook Dispatcher
  │
  ├─► POST /api/webhooks/revenuecat
  ├─► Authorization Header: Bearer <REVENUECAT_WEBHOOK_SECRET>
  ▼
API Server Webhook Handler
  │
  ├─► Verify secret token
  ├─► Parse event payload (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION)
  ├─► Invalidate server-side subscriber cache
  └─► Return 200 OK
  │
Server-Side Quota Enforcement
  │
  ├─► Free Tier: 50 active links, basic analytics, no export
  ├─► Pro Tier: 500 active links, advanced analytics, CSV export
  └─► Pro+ Tier: Unlimited active links, advanced analytics, priority features
```

---

## 5. Environment Variables & Secret Map

| Environment Variable | Target App | Sensitivity | Where Consumed | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | API Server, DB | **CRITICAL SECRET** | `lib/db/src/index.ts`, `lib/db/drizzle.config.ts` | PostgreSQL connection string with SSL configuration. |
| `CLERK_SECRET_KEY` | API Server | **CRITICAL SECRET** | `artifacts/api-server/src/app.ts` | Authenticates backend Clerk API requests and verifies session JWTs. |
| `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` | Both | **PUBLIC** | `artifacts/api-server/src/app.ts`, `artifacts/duka/src/App.tsx` | Identifies Clerk instance for frontend auth modals and server clerkMiddleware. |
| `REVENUECAT_SECRET_KEY` | API Server | **CRITICAL SECRET** | `artifacts/api-server/src/lib/entitlements.ts` | Server-to-server subscriber lookup via RevenueCat REST API v1. |
| `REVENUECAT_WEBHOOK_SECRET` | API Server | **CRITICAL SECRET** | `artifacts/api-server/src/routes/webhooks.ts` | Bearer token verifying incoming webhook dispatch authenticity. |
| `VITE_RC_API_KEY` / `RC_API_KEY` | Frontend | **PUBLIC** | `artifacts/duka/src/lib/revenuecat.ts` | Public RevenueCat client Web Billing SDK key. |
| `SUPABASE_URL` | API Server | Configuration | `artifacts/api-server/src/lib/storage.ts` | Base URL for Supabase storage uploads. |
| `SUPABASE_SERVICE_ROLE_KEY` | API Server | **CRITICAL SECRET** | `artifacts/api-server/src/lib/storage.ts` | Privileged key for uploading order reference images to Supabase S3 bucket. |
| `SUPABASE_STORAGE_BUCKET` | API Server | Configuration | `artifacts/api-server/src/lib/storage.ts` | Name of public bucket for uploaded images (`order-reference-images`). |
| `ALLOWED_ORIGINS` | API Server | Configuration | `artifacts/api-server/src/app.ts` | Comma-separated list of allowed CORS origins. |
| `FRONTEND_URL` / `WEB_URL` | API Server | Configuration | `artifacts/api-server/src/app.ts` | Canonical frontend domain for redirecting human visitors from `/o/:token`. |
| `PORT` | API Server | Configuration | `artifacts/api-server/src/index.ts` | Listening port for Express HTTP server (defaults to 5000). |
| `NODE_ENV` | Both | Configuration | Throughout | Runtime environment (`development`, `production`, `test`). |
| `APP_ENV` | API Server / Scripts | Configuration | `scripts/*` | Safety guard flag (`staging`, `production`). |
