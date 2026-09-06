# CariForge

A governed, seven-agent AI implementation platform, built in the Caribbean, for
the Caribbean. A user states one business goal in plain language; a seven-agent
delivery core defines the need, checks readiness, designs the workflow, applies
safeguards, and prepares and tests a solution — stopped, deliberately, at five
human gates, so a named person decides every consequential transition.

- **Website:** [www.cariforge.com](https://www.cariforge.com)
- **Live platform:** [www.cariforge.com/888](https://www.cariforge.com/888)
- **Live evidence:** 7/7 agents exercised, 5/5 human gates walked, 32/32
  production checks passed on a real case run through the public API,
  including two adversarial checks (a stage-skip attempt and a cross-tenant
  access attempt) — both refused.

## What it does

CariForge closes the **Implementation Void**: organisations across the region
already have the AI ideas, pilots, and workshop follow-ups — what they lack is
a repeatable, governed route from idea to something deployed and trusted. One
goal moves through five gates. Each gate has exactly one owning agent, one
artefact, and one human decision — the sequence is enforced server-side, so a
gate cannot be skipped.

| # | Stage | Agent | Produces | Human decides |
|---|-------|-------|----------|----------------|
| 1 | Need Discovery | Discovery | An evidence-backed Problem Brief — pain points, affected users, constraints | Approve / Return / Stop |
| 2 | Readiness Review | Readiness | A buildability score across five dimensions (data, process, people, technology, governance) | Proceed / Hold / Reject |
| 3 | Workflow Design | Workflow | A current-state and future-state map — who does what, where AI helps, where a human must stay in control | Approve target workflow |
| 4 | Governance Check | Governance | A privacy, bias, safety and legal review — any risk rated critical cannot be approved, with or without controls | Approve (w/ controls) / Return / Stop |
| 5 | Prototype Build | Prototype | A scoped 21-day MVP spec, then a real deployable code scaffold once approved | Accept pilot / Request fixes / Scale / Retire |

Two more agents complete the seven: **Partner & Enabler** matches real
delivery partners (never sharing a contact until explicitly approved, with a
written reason), and **Impact** sets the numbers that define success at year
one, three, and five. Every gate, reply, and reason is written into an audit
trail nobody — including the people who built the platform — can quietly edit.

## Who it's for

Primary buyers are Caribbean governments, public agencies, tourism boards,
development organisations, universities, and enterprises that want to
implement AI but lack a repeatable, governed route from idea to deployment.
A second segment is the region's own founders and SMEs — a fashion designer
in Trinidad who knows AI could help her shipping paperwork, without needing
to know what a "readiness score" is.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4
- Prisma 6 on Supabase Postgres
- better-auth for authentication
- Hosted on Vercel — two deployments from this repo:
  - `cariforge2-0` — the root app
  - `cariforgeplatform-web` — the same app embedded at
    [www.cariforge.com/888](https://www.cariforge.com/888) via Next.js
    `basePath`, proxied from the marketing site
- Built on the Polsia Next.js template (shadcn UI baseline, typed env
  validation, CSP/security headers, Biome, Vitest) — see `AGENTS.md` and
  `.polsia/` for how the underlying scaffold's ownership model works if
  you're extending this codebase.

## Local development

Use npm; the lockfile is committed.

```bash
npm install
npm run typecheck
npm run lint
npm run test
SKIP_ENV_VALIDATION=1 npm run dev
```

`npm run dev` and `npm run build` validate `DATABASE_URL` and
`NEXT_PUBLIC_APP_URL` when `SKIP_ENV_VALIDATION` is not set. On a local clone
without a provisioned database, either set the required vars in `.env.local`
or prefix the command with `SKIP_ENV_VALIDATION=1`. `typecheck`, `lint`, and
`test` do not require env.

## Deployment

Hosted on Vercel (project `cariforge2-0`, plus `cariforgeplatform-web` for the
`/888` embed); database on Supabase (project `cariforge2.0`). Database schema
bootstrap lives in `db/`.

## License

Copyright © 2026 CariForge. All rights reserved.

MIT. See [LICENSE](./LICENSE).
