# Take Order

Take Order is a catalog and order-link system for solo and multi-channel merchants (selling across WhatsApp, Instagram, TikTok, Snapchat, or in-person). It gives sellers a single operating dashboard to manage products, create custom multi-item order links, track fulfillment, log operating expenses, manage subscription entitlements, and understand channel conversion.

---

## Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), Tailwind CSS, Wouter, Radix UI, TanStack React Query, Lucide Icons, Recharts
- **Backend**: [Express 5](https://expressjs.com/) on Node.js 22+, Pino logging, Helmet security headers, Express Rate Limit
- **Database**: [PostgreSQL (Supabase)](https://supabase.com/) managed with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [Clerk](https://clerk.com/) with multi-tenant data isolation (`ownerUserId`)
- **Subscription & Billing**: [RevenueCat](https://www.revenuecat.com/) (Web billing, entitlements verification, and webhook handling)
- **Object Storage**: Supabase Storage for buyer reference images and product media

---

## Monorepo Architecture

Organized as a modular TypeScript monorepo using **pnpm workspaces**:

```
├── artifacts/
│   ├── api-server/         # Express 5 REST API (Node.js 22+, persistent server)
│   ├── duka/               # Main seller workspace & buyer checkout SPA (React 19, Vite, Tailwind CSS)
│   └── mockup-sandbox/     # Standalone component sandbox & preview harness
├── lib/
│   ├── api-spec/           # OpenAPI 3.1 contract source of truth (openapi.yaml + Orval codegen)
│   ├── api-client-react/   # Auto-generated React Query hooks & fetch client
│   ├── api-zod/            # Auto-generated Zod validation schemas & entitlement types
│   └── db/                 # PostgreSQL schema and database client using Drizzle ORM
└── scripts/                # Staging guards, seeders, and migration utilities
```

---

## Local Development

### Prerequisites
- Node.js 22+
- pnpm 9+ (`npm install -g pnpm`)

### 1. Installation
Clone the repository and install all monorepo dependencies:
```bash
git clone <repository-url>
cd takeorder
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your development keys:
```bash
cp .env.example .env
```

Key configuration values in `.env`:
- `PORT`: API server port (default `5000`)
- `DATABASE_URL`: PostgreSQL connection string (Supabase pooled connection)
- `CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`: Clerk authentication keys
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key exposed to Vite
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Supabase project configuration
- `REVENUECAT_SECRET_KEY` & `REVENUECAT_WEBHOOK_SECRET`: Server-side RevenueCat credentials
- `VITE_RC_API_KEY`: Client-side RevenueCat Web SDK key

### 3. Database Setup
Push the Drizzle ORM schema to your PostgreSQL database:
```bash
pnpm --filter @workspace/db run push
```

### 4. Running the Application Locally
Run both services in separate terminals, or use background tasks:

```bash
# Terminal 1: Start API server (port 5000)
pnpm run dev:api

# Terminal 2: Start Frontend (port 5173, proxies /api -> http://localhost:5000)
pnpm run dev:web
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `pnpm run dev:api` | Starts backend API server with hot-reloading |
| `pnpm run dev:web` | Starts frontend Vite dev server |
| `pnpm run typecheck` | Typechecks all workspaces and libraries with TypeScript |
| `pnpm run build` | Compiles both backend and frontend for production |
| `pnpm --filter @workspace/api-server run test` | Runs the backend test suite |
| `pnpm --filter @workspace/take-order run test` | Runs the frontend test suite |
| `pnpm run db:push` | Synchronizes database schema using Drizzle ORM |

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only) - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 &lt;my name&gt;
