# Take Order Route Table & Guard Architecture

This document specifies every route in the Take Order application, its guard classification, layout container, access rules, and loading/transition behavior.

---

## 1. Route Summary Table

| Path | Type | Guard Mechanism | Layout | Fallback / Skeleton During Resolution | Behavior When Unauthenticated | Behavior When Not Onboarded |
|---|---|---|---|---|---|---|
| `/` | Public / Smart Root | `HomeRoute` | Dynamic (`LandingPage` or `<Shell>`) | `<Shell><AppPageSkeleton location="/dashboard" /></Shell>` | Renders `LandingPage` | Redirects to `/onboarding` (replace) |
| `/sign-in/*?` | Auth-only | `SignInPage` | Split Auth Layout (`AuthSplitLayout`) | Split Auth Skeleton | Renders Sign-In form | Direct sign-in -> `/onboarding` |
| `/sign-up/*?` | Auth-only | `SignUpPage` | Split Auth Layout (`AuthSplitLayout`) | Split Auth Skeleton | Renders Sign-Up form | Direct sign-up -> `/onboarding` |
| `/sso-callback` | Auth-only | Clerk SSO Callback | Minimal | Blank/Spinner | Hands off to Clerk auth | Redirects to `/onboarding` or `/dashboard` |
| `/onboarding` | Onboarding | `OnboardingRoute` | Onboarding Flow Container | Centered Onboarding Skeleton | Redirects to `/sign-in?redirect=/onboarding` (replace) | Renders Onboarding Wizard (seller setup) |
| `/dashboard` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` (Persistent Desktop Sidebar + Topbar) | `<Shell><AppPageSkeleton location="/dashboard" /></Shell>` | Redirects to `/sign-in?redirect=/dashboard` (replace) | Redirects to `/onboarding` (replace) |
| `/overview` | Alias | Instant Redirect | None | N/A | Redirects to `/dashboard` (replace) | Redirects to `/dashboard` (replace) |
| `/app` | Alias | Instant Redirect | None | N/A | Redirects to `/dashboard` (replace) | Redirects to `/dashboard` (replace) |
| `/workspace` | Alias | Instant Redirect | None | N/A | Redirects to `/dashboard` (replace) | Redirects to `/dashboard` (replace) |
| `/catalog` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/catalog" /></Shell>` | Redirects to `/sign-in?redirect=/catalog` (replace) | Redirects to `/onboarding` (replace) |
| `/catalog/new` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/catalog" /></Shell>` | Redirects to `/sign-in?redirect=/catalog/new` (replace) | Redirects to `/onboarding` (replace) |
| `/catalog/edit/:id` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/catalog" /></Shell>` | Redirects to `/sign-in?redirect=/catalog/edit/:id` (replace) | Redirects to `/onboarding` (replace) |
| `/orders` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/orders" /></Shell>` | Redirects to `/sign-in?redirect=/orders` (replace) | Redirects to `/onboarding` (replace) |
| `/orders/:id` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/orders/:id" /></Shell>` | Redirects to `/sign-in?redirect=/orders/:id` (replace) | Redirects to `/onboarding` (replace) |
| `/reports/channel-conversion` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/reports" /></Shell>` | Redirects to `/sign-in?redirect=...` (replace) | Redirects to `/onboarding` (replace) |
| `/analytics` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/analytics" /></Shell>` | Redirects to `/sign-in?redirect=/analytics` (replace) | Redirects to `/onboarding` (replace) |
| `/reports` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/analytics" /></Shell>` | Redirects to `/sign-in?redirect=/reports` (replace) | Redirects to `/onboarding` (replace) |
| `/analytics/reports/:slug` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><ReportInsightSkeleton /></Shell>` | Redirects to `/sign-in?redirect=/analytics/reports/:slug` (replace) | Redirects to `/onboarding` (replace) |
| `/reports/:slug` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><ReportInsightSkeleton /></Shell>` | Redirects to `/sign-in?redirect=/reports/:slug` (replace) | Redirects to `/onboarding` (replace) |
| `/clients` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/clients" /></Shell>` | Redirects to `/sign-in?redirect=/clients` (replace) | Redirects to `/onboarding` (replace) |
| `/clients/:key` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/clients" /></Shell>` | Redirects to `/sign-in?redirect=...` (replace) | Redirects to `/onboarding` (replace) |
| `/expenses` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/expenses" /></Shell>` | Redirects to `/sign-in?redirect=/expenses` (replace) | Redirects to `/onboarding` (replace) |
| `/take-order` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/take-order" /></Shell>` | Redirects to `/sign-in?redirect=/take-order` (replace) | Redirects to `/onboarding` (replace) |
| `/settings` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/settings" /></Shell>` | Redirects to `/sign-in?redirect=/settings` (replace) | Redirects to `/onboarding` (replace) |
| `/connect` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/settings" /></Shell>` | Redirects to `/sign-in?redirect=/connect` (replace) | Redirects to `/onboarding` (replace) |
| `/integrations` | Seller Protected | `SellerRoute` (One Bootstrap Gate) | `<Shell>` | `<Shell><AppPageSkeleton location="/settings" /></Shell>` | Redirects to `/sign-in?redirect=/integrations` (replace) | Redirects to `/onboarding` (replace) |
| `/account/billing` | Seller Account | Auth token + entitlement check | Standalone Sub-Shell Header | Loading Skeleton (`data-route="loading-skeleton"`) | Redirects to `/sign-in?redirect=/account/billing` (replace) | Renders Billing management |
| `/billing` | Alias | Instant Redirect | None | N/A | Redirects to `/account/billing` (replace) | Redirects to `/account/billing` (replace) |
| `/settings/billing` | Alias | Instant Redirect | None | N/A | Redirects to `/account/billing` (replace) | Redirects to `/account/billing` (replace) |
| `/settings/subscription` | Alias | Instant Redirect | None | N/A | Redirects to `/account/billing` (replace) | Redirects to `/account/billing` (replace) |
| `/settings/pro` | Alias | Instant Redirect | None | N/A | Redirects to `/account/billing` (replace) | Redirects to `/account/billing` (replace) |
| `/subscribe` | Seller Checkout | RevenueCat Billing | Checkout Container | Skeleton | Redirects to `/sign-in?redirect=/subscribe` (replace) | Renders Plan Checkout |
| `/subscription` | Alias | Instant Redirect | None | N/A | Redirects to `/subscribe` (replace) | Redirects to `/subscribe` (replace) |
| `/paywall` | Alias | Instant Redirect | None | N/A | Redirects to `/subscribe` (replace) | Redirects to `/subscribe` (replace) |
| `/pricing` | Alias | Instant Redirect | None | N/A | Redirects to `/subscribe` (replace) | Redirects to `/subscribe` (replace) |
| `/terms` | Public | None | Static Content Container | Plain HTML | Accessible | Accessible |
| `/terms-of-service` | Alias | Instant Redirect | None | N/A | Redirects to `/terms` (replace) | Redirects to `/terms` (replace) |
| `/privacy` | Public | None | Static Content Container | Plain HTML | Accessible | Accessible |
| `/privacy-policy` | Alias | Instant Redirect | None | N/A | Redirects to `/privacy` (replace) | Redirects to `/privacy` (replace) |
| `/refund-policy` | Public | None | Static Content Container | Plain HTML | Accessible | Accessible |
| `/refunds` | Alias | Instant Redirect | None | N/A | Redirects to `/refund-policy` (replace) | Redirects to `/refund-policy` (replace) |
| `/cancellation-policy` | Alias | Instant Redirect | None | N/A | Redirects to `/refund-policy` (replace) | Redirects to `/refund-policy` (replace) |
| `/o/:token` | Public | None | Buyer Checkout Page | Buyer Page Skeleton | Accessible (Public Buyer Page) | Accessible (Public Buyer Page) |
| `*` (Not Found) | Catch-All | None | Not Found Container | Plain HTML | 404 Not Found Page | 404 Not Found Page |

---

## 2. Guard Architectures & Rules

### A. One Bootstrap Gate for Protected Routes (`SellerRoute`)
Protected seller routes do not render any page-level content, paywalls, or secondary redirects until all state dimensions have resolved:
1. **Authentication Resolution**: Clerk auth loaded, token getter attached, or test auth initialized (`authState !== 'loading' && isLoaded`).
2. **Profile & Onboarding Resolution**: `useGetSellerSettings` resolved or local seller profile present.
3. **Skeleton Phase**: While resolving, `SellerRoute` renders ONLY `<Shell><AppPageSkeleton location={location} /></Shell>` with `data-route="loading-skeleton"`. During this phase, neither sign-in, sign-up, onboarding, landing, paywall, nor 404 components are ever rendered into the DOM.
4. **Resolution Branching**:
   - Definitively signed out (`authState === 'signed_out'`): Declarative replace navigation `<Redirect to="/sign-in?redirect=..." replace />`.
   - Definitively signed in but not onboarded: Declarative replace navigation `<Redirect to="/onboarding" replace />`.
   - Definitively signed in and onboarded: Renders `<Shell>{children}</Shell>`.

### B. Stable AppShell Across Navigation (`ShellContext`)
1. `<ShellContext>` tracks whether an outer `<Shell>` has already been mounted.
2. When transitioning between protected seller routes, the sidebar, desktop topbar (`saas-topbar`), and background remain permanently mounted in the DOM.
3. Nested `<Shell>` calls inside individual page components cleanly pass through their children without unmounting or remounting DOM elements.

### C. Pre-Render Skeleton in `index.html`
1. `#static-shell-skeleton` is embedded directly into `index.html` with `--background` matching `#F6F6FA`.
2. The initial HTML frame displays the 272px desktop sidebar placeholder, 60px header placeholder, and card skeletons before any JavaScript bundle executes.
3. Prevents white-screen or empty frame paints during slow network and throttled CPU cold starts.

### D. 401 Interception and Retries
1. `customFetch` intercepts 401 Unauthorized responses.
2. It requests a fresh authentication token via `getAuthToken()` and automatically retries the request once.
3. It never executes `window.location.href = '/sign-in'` while authentication is still loading or tokens are refreshing, preventing reload loops.
