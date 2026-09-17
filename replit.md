# Take Order

Take Order helps small multi-channel sellers manage products, share buyer order links, and understand sales, inventory, and channel performance in one workspace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + production build all packages, including the Take Order artifact with its release environment
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/duka/src/App.tsx` — seller workspace and public buyer flow
- `artifacts/duka/src/index.css` — Take Order visual theme and responsive layout
- `artifacts/api-server/src/routes/take-order.ts` — catalog, orders, buyer links, and dashboard API
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/products.ts` and `lib/db/src/schema/orders.ts` — PostgreSQL schema

## Architecture decisions

- Seller actions are deliberately channel-agnostic: Take Order records where a conversation started, but never reads personal chats.
- Public buyer links use a short token and do not require a buyer account.
- Inventory decrements only when an order becomes fully paid; reservations remain visible without pretending they are sales.
- The first build keeps payment-provider wiring behind the buyer submission boundary so the product loop can be exercised before provider credentials are connected.

## Product

- Dashboard with revenue, paid orders, outstanding deposit balances, best seller, channel performance, and plain-language insights.
- Catalog CRUD for products, costs, stock, variants, and category.
- Take Order link generation with full payment, deposit, or reservation modes and channel attribution.
- Public buyer checkout/reservation page with buyer contact details, notes, and reference image input.
- Order status and fulfillment tracking with copied buyer links.

## User preferences

The visual direction should stay calm, confident, and useful for a solo seller who does not want enterprise software.

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.
- Use the shared API server workflow for `/api`; the Take Order web app uses the root preview path.
- Run `pnpm run build` before release to catch Take Order production bundling failures.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
