// @polsia:user-owned — GET /api/blog. Static catalog of editor content
// published for the regulated-buyer audience, served from an in-process
// constant (no DB). The page goes through this handler anyway because the
// project rule bans data-fetch in Server Components, and a client
// `apiFetch('/api/blog')` keeps the contract shape consistent with every
// other resource. To append a post, add one object literal to CATALOG.

import 'server-only';
import { NextResponse } from 'next/server';
import { BlogList } from '@/lib/contracts/blog';

export const dynamic = 'force-dynamic';

const CATALOG = [
  {
    id: 'eu-ai-act-articles-12-14-shaped-by-design',
    slug: 'eu-ai-act-articles-12-14-shaped-by-design',
    title: 'EU AI Act Articles 12 & 14 — shaped by design, not bolted on.',
    hook: 'Why the council records are written before any code is generated, so the record-keeping and human-oversight expectations are produced as a by-product rather than patched in.',
    date: '2026-04-22',
    topic: 'EU AI Act',
    relatedHref: null,
    relatedLabel: null,
  },
  {
    id: 'a-hash-chained-bundle-auditor-can-replay',
    slug: 'a-hash-chained-bundle-an-auditor-can-replay',
    title: 'A hash-chained bundle an auditor can replay.',
    hook: 'Five artefacts per run, appended in order, SHA-256 linked — so an audit officer can re-trace the case end-to-end and any tampering breaks the chain.',
    date: '2026-05-14',
    topic: 'Audit',
    relatedHref: '/sample-brief',
    relatedLabel: 'Read the worked example',
  },
  {
    id: 'evidence-packs-for-procurement-programmes',
    slug: 'evidence-packs-for-procurement-programmes',
    title: 'Evidence packs for procurement programmes that run in quarters.',
    hook: 'How a consolidated cross-case evidence package, with a per-case hash chain, keeps the audit officer and the procurement timeline on the same page.',
    date: '2026-06-30',
    topic: 'Procurement',
    relatedHref: null,
    relatedLabel: null,
  },
] as const;

export async function GET() {
  return NextResponse.json(BlogList.parse({ items: CATALOG }));
}
