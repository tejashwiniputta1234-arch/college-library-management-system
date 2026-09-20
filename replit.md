# College Library Management System

A responsive library desk for college administrators to manage books, students, and issue-return activity.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/college-library run dev` — run the React/Vite web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — provisioned PostgreSQL connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack React Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/college-library/src/` — responsive dashboard, catalogue, students, and circulation UI
- `artifacts/api-server/src/routes/library.ts` — REST handlers and small seed dataset
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/db/src/schema/index.ts` — books, students, and circulation tables
- `lib/api-client-react/src/generated/` — generated React Query client

## Architecture decisions

- The app uses the Replit-provisioned PostgreSQL database for persistence and Drizzle for typed access so it runs without requiring a separate MongoDB service or user-provided connection string.
- OpenAPI remains the source of truth; client hooks and Zod schemas are regenerated from it.
- Dashboard counts represent inventory copies, while issue records represent individual circulation events.
- Seed data is inserted once when the API starts against an empty library database.

## Product

- Dashboard with total inventory, registered students, active loans, available copies, and recent circulation
- Searchable book catalogue with add, edit, delete, and availability tracking
- Student directory with add and delete
- Issue and return workflows with due dates and overdue status
- Responsive desktop sidebar and mobile navigation

## User preferences

- Keep the scope simple, practical, and suitable for a third-year B.Tech college project.

## Gotchas

- Run API codegen after editing `lib/api-spec/openapi.yaml`.
- The API seeds only when the books table is empty, so a reset of the development database is needed to restore the initial sample dataset.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
