# Authenticated e2e suite

Added 2026-09-04. Real user request: *"I need you to QA the development
after log in. It can't just be me... find a skill to do this type of
testing behind a log in."*

This is what answers that going forward — a repeatable, automated way to
test everything behind the login, not a one-off manual pass.

## How auth works here (read this before anything else)

There is **no bypass of the app's real login**. `global-setup.ts` signs in
two real QA accounts through the app's own `POST /api/auth/sign-in/email`
and `sign-up/email` endpoints — the exact same code path a real user's
browser hits — using Playwright's API-request client (plain HTTP, not a
browser). The server issues a real session cookie either way; every spec in
this suite carries that same cookie and gets exactly the response the app
would give any other signed-in browser. Nothing in the app itself was
weakened or given a test-only shortcut to make this work.

## The two QA accounts

| Role | Email | Purpose |
|---|---|---|
| Plain user | `qa-submitter@cariforge.test` | Verifies the real submitter experience — no admin surfaces, own-data-only scoping. |
| Admin | `qa-admin@cariforge.test` | Signed up the same way, then promoted with one SQL statement (`UPDATE "user" SET role = 'admin' WHERE email = 'qa-admin@cariforge.test'`) run once against the `cariforge2-0-prod` Supabase project — same mechanism the app's own `admin()` plugin uses, not a new code path. |

Both accounts' passwords were generated for this session and are **not**
committed anywhere in this repo. Set them locally in `.env.local`
(already gitignored) or your shell before running the suite:

```bash
QA_SUBMITTER_PASSWORD="..."
QA_ADMIN_PASSWORD="..."
```

If you ever lose them, don't try to recover them — just pick new ones and
either update the two accounts' passwords in the Supabase `user`/`account`
tables, or delete the two rows and let `global-setup.ts` recreate them via
sign-up on the next run (it falls back to sign-up automatically when
sign-in fails).

## Running it

One-time setup (downloads a real Chromium binary — only needed to actually
run tests, not to read/edit this suite's source):

```bash
npx playwright install chromium
```

Then:

```bash
npm run test:e2e
```

By default this runs against production (`https://cariforge2-0.vercel.app`).
To run against a local dev server instead:

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## What's covered so far

- `submitter.spec.ts` — the plain-user role: dashboard shows no admin
  surfaces, Forge Canvas palette renders, Approvals is empty for a fresh
  account, `/dashboard/pipeline` is reachable once signed in, admin-only
  routes correctly refuse this role.
- `admin.spec.ts` — the admin role: dashboard shows "Admin access",
  Approvals labels other people's tasks "Not yours" (the original
  Judge-Demo/QA-E2E confusion this session fixed), admin-only routes
  succeed, `GET /api/agents` returns full operational-boundary detail.

This is a starting scaffold, not exhaustive coverage — add specs here as
new authenticated features ship, the same way `tests/unit/*.test.ts`
already covers the non-authenticated logic.
