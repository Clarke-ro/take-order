# TAKE ORDER — STAGING DEPLOYMENT RUNBOOK

This runbook guides the step-by-step setup and verification of the **Take Order Staging Environment** across:
* **Frontend**: Vercel (Vite SPA)
* **Backend**: Heroku (Express API)
* **Database**: Dedicated Staging PostgreSQL
* **Authentication**: Clerk (Development Instance)
* **Billing**: RevenueCat (Sandbox Project)

---

## 1. PRE-DEPLOYMENT ARCHITECTURE & CONSTRAINTS

| Service | Staging Target | Environment Guardrails |
| :--- | :--- | :--- |
| **Frontend** | Vercel (`takeorder-staging.vercel.app`) | Client-only env vars (`VITE_*`). No secrets exposed. |
| **Backend** | Heroku (`takeorder-api-staging.herokuapp.com`) | `trust proxy` enabled, root `/health` endpoint live. |
| **Database** | Staging Postgres (Dedicated) | `sslmode=require`, isolated from production & local DBs. |
| **Auth** | Clerk Development Instance | Publishable Key (`pk_test_...`) & Secret (`sk_test_...`). |
| **Billing** | RevenueCat Sandbox Project | Sandbox API key (`rcb_sb_...`) & Webhook authorization secret. |

### Confirmed Commercial Model & Limits

| Tier | Products | Active Links | Analytics | Analytics Export (CSV) |
| :--- | :--- | :---: | :--- | :--- |
| **Free** | Unlimited | 50 | Basic | No |
| **Pro** | Unlimited | 500 | Advanced | Yes |
| **Pro+** | Unlimited | Unlimited | Advanced | Yes |

* **Trial Policy**: `TRIAL_DURATION_DAYS = 7`. New accounts receive full Pro access for 7 days, then automatically transition to Free.
* **Downgrade Preservation**: Existing links & products are strictly preserved after downgrade; existing links continue accepting buyer checkouts; only *new* link creation beyond the active limit (50 for Free, 500 for Pro) is blocked.

> [!CAUTION]
> **Strict Guard**: Never use production credentials (`pk_live_...`, production database URLs, or live RevenueCat API keys) in the staging environment.

---

## 2. STEP-BY-STEP DEPLOYMENT WORKFLOW

### Step 1: Provision the Staging Database
1. Create a dedicated staging PostgreSQL database (e.g., Heroku Postgres Staging add-on, Supabase staging project, or Neon staging branch).
2. Copy the connection string. Ensure it includes SSL parameters:
   ```text
   postgres://<user>:<password>@<staging-host>:5432/<staging-db>?sslmode=require
   ```
3. Test connectivity locally:
   ```bash
   DATABASE_URL="postgres://..." pnpm run db:push
   ```
   *(This synchronizes the Drizzle schema to the empty staging database non-destructively).*

---

### Step 2: Heroku Backend Setup
1. **Create Heroku App**:
   ```bash
   heroku apps:create takeorder-api-staging
   ```
2. **Configure Heroku Buildpacks**:
   Ensure Node.js buildpack is set:
   ```bash
   heroku buildpacks:set heroku/nodejs -a takeorder-api-staging
   ```
3. **Set Heroku Config Vars**:
   Execute the following config settings (replace placeholders with staging values):
   ```bash
   heroku config:set NODE_ENV=production -a takeorder-api-staging
   heroku config:set APP_ENV=staging -a takeorder-api-staging
   heroku config:set DATABASE_URL="postgres://<user>:<password>@<staging-host>:5432/<staging-db>?sslmode=require" -a takeorder-api-staging
   heroku config:set FRONTEND_URL="https://takeorder-staging.vercel.app" -a takeorder-api-staging
   heroku config:set ALLOWED_ORIGINS="https://takeorder-staging.vercel.app,http://localhost:5173" -a takeorder-api-staging
   heroku config:set CLERK_PUBLISHABLE_KEY="pk_test_..." -a takeorder-api-staging
   heroku config:set CLERK_SECRET_KEY="sk_test_..." -a takeorder-api-staging
   heroku config:set REVENUECAT_SECRET_KEY="sk_..." -a takeorder-api-staging
   heroku config:set REVENUECAT_WEBHOOK_SECRET="<generate_secure_random_token>" -a takeorder-api-staging
   heroku config:set SUPABASE_URL="https://<staging-project>.supabase.co" -a takeorder-api-staging
   heroku config:set SUPABASE_SERVICE_ROLE_KEY="<staging_service_role_key>" -a takeorder-api-staging
   heroku config:set SUPABASE_STORAGE_BUCKET="order-reference-images" -a takeorder-api-staging
   ```

#### Heroku Config Var Origin & Source Guide
| Variable | Origin / Provider | Instructions |
| :--- | :--- | :--- |
| `NODE_ENV` | Static Configuration | Set to `production` on Heroku to enable framework optimizations. |
| `APP_ENV` | Static Configuration | Set to `staging`. Required by staging guardrails. |
| `DATABASE_URL` | Dedicated Staging Database | Obtained from your Staging Postgres provider with `?sslmode=require`. |
| `FRONTEND_URL` | Vercel Staging Project | Set to `https://takeorder-staging.vercel.app`. Used for human buyer link redirects. |
| `ALLOWED_ORIGINS` | CORS Configuration | Whitelist: `https://takeorder-staging.vercel.app,http://localhost:5173`. |
| `CLERK_PUBLISHABLE_KEY` | Clerk Development Instance | Found in [Clerk Dashboard](https://dashboard.clerk.com) > **API Keys** (`pk_test_...`). |
| `CLERK_SECRET_KEY` | Clerk Development Instance | Found in [Clerk Dashboard](https://dashboard.clerk.com) > **API Keys** (`sk_test_...`). |
| `REVENUECAT_SECRET_KEY` | RevenueCat Sandbox Project | Found in [RevenueCat Dashboard](https://app.revenuecat.com) > **Project Settings > API Keys > Secret API Key** (`sk_...`). Used for server-to-server subscriber lookup. |
| `REVENUECAT_WEBHOOK_SECRET` | User Generated | Generate via `openssl rand -hex 24`. Paste matching token into RevenueCat webhook `Authorization` header. |
| `SUPABASE_URL` | Supabase Staging Project | Found in Supabase > Project Settings > API > Project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Staging Project | Found in Supabase > Project Settings > API > `service_role` secret. |
| `SUPABASE_STORAGE_BUCKET` | Supabase Staging Bucket | Set to `order-reference-images` for customer reference photo uploads. |
4. **Deploy Backend to Heroku**:
   Connect GitHub repository to Heroku via Dashboard (or git remote), deploying the staging branch. Heroku will run `heroku-postbuild` (`pnpm --filter @workspace/api-server run build`) and start the server using the root `Procfile`:
   ```text
   web: pnpm --filter @workspace/api-server run start
   ```

---

### Step 3: Vercel Frontend Setup
1. **Import Git Repository in Vercel**:
   - Create new project on Vercel.
   - Root Directory: `./` (leave as root; Vercel will detect root `vercel.json` and `pnpm-workspace.yaml`).
   - Framework Preset: `Vite`.
   - Build Command: `pnpm run build:web`
   - Output Directory: `artifacts/duka/dist/public`
2. **Set Vercel Environment Variables** (Environment: *Preview* & *Production* for staging project):
   ```text
   VITE_API_URL=https://takeorder-api-staging.herokuapp.com
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   VITE_RC_API_KEY=rcb_sb_...
   VITE_RC_ENTITLEMENT_PRO=take_order_app_pro
   VITE_RC_ENTITLEMENT_PRO_PLUS=take_order_app_pro_plus
   ```
3. **Deploy Vercel Project**:
   Trigger deployment. Verify the client bundle builds cleanly and serves at `https://takeorder-staging.vercel.app`.

---

### Step 4: Configure Clerk Development Instance
1. Go to [Clerk Dashboard](https://dashboard.clerk.com) > Select Development Instance.
2. In **Paths & Allowed Origins**:
   - Add `https://takeorder-staging.vercel.app` to Authorized Origins.
   - Add redirect URLs:
     * Sign-in: `https://takeorder-staging.vercel.app`
     * After sign-in: `https://takeorder-staging.vercel.app`
3. Under **Domain & Proxies**:
   - Verify CORS allows requests from `takeorder-staging.vercel.app` to Clerk's Frontend API.

---

### Step 5: Configure RevenueCat Sandbox & Webhooks
1. In [RevenueCat Dashboard](https://app.revenuecat.com):
   - Project: Take Order (Sandbox)
   - Verify Entitlements:
     * `take_order_app_pro`
     * `take_order_app_pro_plus`
2. Configure Webhook Integration:
   - Webhook URL: `https://takeorder-api-staging.herokuapp.com/api/webhooks/revenuecat`
   - Authorization Header: `Bearer <REVENUECAT_WEBHOOK_SECRET>` (matching the Heroku config var set in Step 2).
   - Events enabled: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `PRODUCT_CHANGE`, `UNCANCELLATION`.
3. Click **Send Test Event** in RevenueCat dashboard and check Heroku logs to verify `200 OK`.

> [!NOTE]
> **Cache Architecture Note**: Entitlements are cached in-memory with a 60-second TTL per backend process. In staging with a single Heroku web dyno (e.g., `web.1`), incoming webhooks immediately bust the in-memory cache for that seller. For multi-dyno production setups, a shared distributed cache (e.g., Redis) or pub/sub message bus is required to propagate webhook cache invalidations across all dynos.

---

### Step 6: Staging Database Operations (Seed & Reset)

All staging database scripts require `APP_ENV=staging` and `CONFIRM_STAGING=1` to prevent accidental execution against non-staging environments.

#### Seeding Initial Staging Data
To seed realistic test sellers, products, order links, and expenses into the staging DB:
```bash
APP_ENV=staging CONFIRM_STAGING=1 DATABASE_URL="postgres://<user>:<password>@<staging-host>:5432/<staging-db>?sslmode=require" pnpm run db:seed:staging
```
*Creates Seller 1 (`staging_seller_ama` - Accra Artisan Bakery) & Seller 2 (`staging_seller_kwame` - Kente Luxe Boutique).*

#### Resetting Staging Data
To wipe only staging test seller records:
```bash
APP_ENV=staging CONFIRM_STAGING=1 DATABASE_URL="postgres://<user>:<password>@<staging-host>:5432/<staging-db>?sslmode=require" pnpm run db:reset:staging
```
To wipe all rows completely:
```bash
APP_ENV=staging CONFIRM_STAGING=1 DATABASE_URL="postgres://..." pnpm --filter @workspace/scripts run reset:staging -- --all
```

#### Simulating 7-Day Trial Expiration
To test plan downgrading to `free` (verifying active links survive):
```bash
APP_ENV=staging CONFIRM_STAGING=1 DATABASE_URL="postgres://<user>:<password>@<staging-host>:5432/<staging-db>?sslmode=require" pnpm run db:simulate-expiry -- --sellerId=staging_seller_ama --daysAgo=30
```

---

## 3. POST-DEPLOYMENT SMOKE TEST CHECKLIST

Run through this verification sequence once staging is deployed:

- [ ] **1. Backend Health Check**:
  Run `curl -i https://takeorder-api-staging.herokuapp.com/health`.
  Expected: HTTP 200, `{"status":"ok"}` (exposing no secrets or database internals).
- [ ] **2. CORS & Proxy Headers**:
  Run `curl -i -H "Origin: https://takeorder-staging.vercel.app" https://takeorder-api-staging.herokuapp.com/health`.
  Expected: `Access-Control-Allow-Origin: https://takeorder-staging.vercel.app`.
- [ ] **3. Frontend Landing & Sign-in**:
  Open `https://takeorder-staging.vercel.app`. Sign in using a Clerk test account.
- [ ] **4. Seller Dashboard & Entitlements**:
  Verify new accounts enter **7-day free trial** with full Pro capabilities.
  Verify dashboard KPIs and currency settings load without error.
- [ ] **5. Product Catalog & Unlimited Products**:
  Add multiple products (> 10 items) with variants and reference images. Confirm no product limit is imposed.
- [ ] **6. Take Order Link Generation & Free Tier Limits**:
  - Verify link generation succeeds up to the Free limit of 50 active links.
  - Verify creating link 51 returns HTTP 403 `LINK_LIMIT_REACHED`.
  - Verify direct API requests cannot bypass the 50-link limit.
- [ ] **7. Buyer Checkout Flow**:
  Open an active link in an incognito window:
  - Verify product image, details, variant selector, and delivery choice render.
  - Complete checkout as buyer (full or deposit).
  - Return to seller dashboard: verify order moves to `reserved` / `paid` with captured cost.
- [ ] **8. Pro & Pro+ Entitlement Activation**:
  - In RevenueCat Sandbox, grant `take_order_app_pro` to the test account. Verify limit expands to 500 links, and link 501 is rejected.
  - Grant `take_order_app_pro_plus` to the test account. Verify unlimited link creation.
- [ ] **9. RevenueCat Webhook Invalidation**:
  Simulate a subscription event in RevenueCat sandbox. Verify webhook returns 200, cache clears immediately, and seller tier updates without latency.
- [ ] **10. Trial Expiry & Downgrade (Link Survival)**:
  Run `pnpm run db:simulate-expiry`. Refresh seller dashboard:
  - Seller badge changes from `TRIAL` to `FREE`.
  - Existing links (> 50) still load and accept checkout without 403 or 404.
  - New link generation is blocked once at or above the Free limit (50 active links).

---

## 4. ROLLBACK & INCIDENT RECOVERY PLAN

### Heroku Backend Rollback
If an API release causes crashes:
```bash
# Check release history
heroku releases -a takeorder-api-staging

# Instantly roll back to previous stable release
heroku rollback v<previous_release_number> -a takeorder-api-staging
```

### Vercel Frontend Rollback
1. Open Vercel Dashboard > Project `takeorder-staging` > Deployments.
2. Select previous stable deployment > Click `...` > **Promote to Production** (instant zero-downtime rollback).

### Database Disaster Recovery
1. The staging schema push is non-destructive (`drizzle-kit push`).
2. If corrupt staging records occur, execute `pnpm run db:reset:staging` followed by `pnpm run db:seed:staging`.
