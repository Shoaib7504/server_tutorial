# AGENTS.md

Express 5 + Prisma ORM 7 tutorial app (ESM, `"type": "module"`). Small monorepo-less app: `src/server.js` → `src/routes/movies.route.js` → `src/config/db.connect.js`.

## Prisma 7 — do not follow v6 patterns

- Uses **Prisma ORM 7** (`prisma@7.9.1`). The `prisma-client` generator writes the client to `src/generated/prisma`, which is **gitignored** and does not exist until you run `npx prisma generate`. There is no `@prisma/client`-in-node_modules fallback.
- The generated client is **TypeScript** (`.ts`) — `prisma-client` cannot emit plain `.js`. This is a plain-JS project, so `db.connect.js` imports it directly: `import { PrismaClient } from '../generated/prisma/client.ts'`. This works because Node ≥ 22.6 strips types natively (project requires Node 24). Do not rename/compile these files.
- `schema.prisma` generator block must keep `importFileExtension = "ts"` so generated internal imports resolve under Node type-stripping.
- v7 SQL apps need a **driver adapter**: `@prisma/adapter-pg` + `pg` are installed; `db.connect.js` builds a `PrismaPg` adapter from `DATABASE_URL`.
- **dotenv gotcha:** ESM imports are evaluated before `server.js`'s body runs `dotenv.config()`. `db.connect.js` must import `'dotenv/config'` at the top (it does), otherwise the adapter gets an undefined connection string and `$connect()` silently succeeds while the first real query fails with `SASL: client password must be a string`.
- `schema.prisma` has **no `url`** on the datasource — it's supplied in `prisma.config.ts`, which already does `import "dotenv/config"`. Prisma CLI does **not** auto-load `.env`; keep that import in `prisma.config.ts`.
- Load the `prisma-upgrade-v7` skill (`.agents/skills/`) before touching Prisma code.

## Database

- `DATABASE_URL` in `.env` points to a remote Neon Postgres instance. `.env` is gitignored; never commit it or print its values.
- No `prisma/migrations/` directory yet and the `Movie` table has **not been created** in the DB — `prisma.movie.*` queries fail with `TableDoesNotExist` until you run `npx prisma migrate dev`. `prisma.config.ts` sets migrations path to `prisma/migrations`.
- `db.connect.js` exports `prisma`, `dbConnect`, `dbClose`; server wires shutdown handlers around them.

## Commands

- `npm run dev` — nodemon on `src/server.js` (main dev loop)
- `npm start` — `node src/server.js`
- `npx prisma generate` / `npx prisma migrate dev` — after schema edits
- No tests, lint, or typecheck configured; `npm test` is a stub that errors. Verify by running the server.

## Style notes

- ESM: relative imports must include `.js` extensions.
- `src/routes/movies.route.js` routes are currently stubs returning mock JSON — the DB wiring exists but is not used by routes yet.
- Prisma skills are installed at `.agents/skills/` (symlinked into `.claude/skills` and `.windsurf/skills`); reference them rather than inline Prisma docs.
