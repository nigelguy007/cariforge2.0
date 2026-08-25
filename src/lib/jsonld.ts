// @polsia:user-owned — centralized schema.org JSON-LD payloads. Single source
// of truth so the home, pricing, and blog pages don't drift apart on
// name/url/logo. Server-renderable anywhere; no `server-only`, no DB, no
// `next/headers` — the existing <JsonLd/> component handles rendering.
//
// Why a dedicated file: the inline `const organization = { ... }` was
// duplicated across the home and pricing pages (and as a nested `publisher`
// on the blog page). One shared `organization` + `website` here ends that
// drift without inflating any single page.
//
// The pricing page's `Product` (with its three bespoke `Offer` shapes) is
// INTENTIONALLY kept inline there — it's page-local content, not a shared
// brand payload, so abstracting it would just push duplication sideways.

import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteName,
  url: siteUrl,
  description: siteDescription,
  logo: `${siteUrl}/icon.svg`,
  sameAs: [],
} as const;

// `WebSite` lives on `/` (the canonical home) and carries a `SearchAction`
// pointed at /blog?q=... — the only genuinely query-able surface the app
// has today. Add an explicit /search route later and repoint this template.
export const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteName,
  url: siteUrl,
  description: siteDescription,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteUrl}/blog?q={search_term_string}`,
    },
    // schema.org/QueryInputType — the only standard text-input value.
    'query-input': 'required name=search_term_string',
  },
} as const;
