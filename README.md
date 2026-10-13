# MealMate — Student MVP

Shared weekly meal planning for student "quads" — set food preferences once,
get a shared weekly menu, skip meals, propose edits, and see a grocery list.
Student-side only for this release (see `CLAUDE.md` for full scope and the
decisions this build is based on).

## Stack

- Next.js 16 (App Router, TypeScript)
- Prisma 7 + Neon Postgres (`@prisma/adapter-pg`)
- Auth.js v5 (Credentials provider, bcryptjs, JWT sessions)
- PostHog (`posthog-js` + `posthog-node`)
- Deployed on Vercel

## Local development

```bash
npm install
npx prisma generate
npm run dev
```

Requires a `.env.local` with `DATABASE_URL`, `AUTH_SECRET`,
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_KEY`,
`POSTHOG_HOST` — see `.env` for the Prisma-only `DATABASE_URL` placeholder.

## Database

```bash
npx prisma migrate deploy   # apply migrations
npx prisma db seed          # seed the curated dish catalog
```

test edit successful
