# DivineDesk

> <!-- TODO: one-line pitch, e.g. "A modern desk for managing X for Y." -->

**Live app:** [divine-desk.vercel.app](https://divine-desk.vercel.app)

## Overview

DivineDesk is a full-stack TypeScript web application with a React single-page frontend and an Express API, backed by PostgreSQL. It supports user authentication and tiered subscription billing (Starter, Growth and Enterprise plans) through Paystack.

<!-- TODO: add 2-3 sentences on the problem it solves and who it's for. -->

## Features

- Secure authentication using JWT and bcrypt-hashed passwords
- Subscription plans with hosted Paystack checkout
- Real-time capabilities over WebSockets
- Postgres database (Neon) managed with Prisma migrations
- Responsive UI built from Radix UI and Tailwind components
- Deployable to Vercel or Netlify

<!-- TODO: replace/extend with your actual product features. -->

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, React Router 6, TypeScript, Vite, Tailwind CSS, Radix UI, Framer Motion, Recharts, Three.js |
| Backend | Express 5, Zod, `ws` |
| Database | PostgreSQL (Neon) with Prisma |
| Payments | Paystack |
| Testing | Vitest |
| Hosting | Vercel / Netlify |

## Getting Started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+
- A PostgreSQL database (a free [Neon](https://neon.tech) project works well)

### Installation

```bash
git clone https://github.com/beklegal/DivineDesk.git
cd DivineDesk
pnpm install
cp .env.example .env
```

Fill in `.env` (see [Environment Variables](#environment-variables)), then set up the database and start the dev server:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

The app runs at http://localhost:8080, with the client and API served on a single port.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `APP_URL` | Public URL of the app (`http://localhost:8080` locally) |
| `DATABASE_URL` | Runtime Postgres connection string (use the pooled Neon URL) |
| `DIRECT_URL` | Direct, non-pooled connection used by Prisma migrations |
| `JWT_SECRET` | Long random secret used to sign auth tokens |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_STARTER_CHECKOUT_URL`, `PAYSTACK_GROWTH_CHECKOUT_URL`, `PAYSTACK_ENTERPRISE_CHECKOUT_URL` | Hosted checkout links per plan |
| `PAYSTACK_*_PLAN_CODE` | Optional plan codes for API-driven checkout |
| `DEBUG_API_REQUESTS` | Set to `true` to log API requests |
| `DIVINEDESK_DATA_DIRECTORY` | Optional local JSON-file fallback instead of Postgres |

> Never commit your real `.env`. Only `.env.example` belongs in version control.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server (client and API) |
| `pnpm build` | Build the client and server for production |
| `pnpm start` | Run the production server |
| `pnpm test` | Run the Vitest suite |
| `pnpm typecheck` | Type-check the project |
| `pnpm format.fix` | Format code with Prettier |
| `pnpm prisma:generate` | Generate the Prisma client |
| `pnpm prisma:migrate` | Apply database migrations |

## Project Structure

```
client/             React SPA (pages, components, routing)
server/             Express API (routes and handlers)
shared/             Types shared by client and server
prisma/             Database schema and migrations
api/                Vercel serverless entry
netlify/functions/  Netlify serverless entry
scripts/            Build and deploy helpers
public/             Static assets
```

## Deployment

DivineDesk is configured for both platforms:

- **Vercel:** `vercel.json` and `pnpm vercel-build` handle the build and migrations. Set the environment variables in your project settings.
- **Netlify:** `netlify.toml` and the functions in `netlify/functions` are included.

## Contributing

Issues and pull requests are welcome. Please run `pnpm typecheck` and `pnpm test` before submitting.

## License

<!-- TODO: add a LICENSE file and name it here, e.g. MIT. -->

## Author

Built by [@beklegal](https://github.com/beklegal).
