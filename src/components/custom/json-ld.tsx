// @polsia:user-owned — server-renderable JSON-LD renderer. Takes a schema.org
// payload and emits the inline <script type="application/ld+json"> tag that
// search engines read alongside the page HTML. Pure markup: no data fetch, no
// client APIs, no server-only imports — safe to render in a Server Component
// page body (the canonical home for SEO structured data).
//
// For the shared `Organization` / `WebSite` payloads, import them from
// `@/lib/jsonld` (a single source of truth) instead of redefining `{name,
// url, logo}` inline — three pages used to carry the same literals and drift
// was a real risk. Page-specific schemas (e.g. a `Product` with bespoke
// `Offer`s on /pricing) are fine to inline in the page file.
//
// Implementation note: passes the JSON string as a `<script>` child rather
// than `dangerouslySetInnerHTML`. React does NOT HTML-escape `<script>`
// children (by design — to preserve JavaScript syntax), so the JSON is
// rendered raw. The payload is constructed from in-code string literals
// only, so the `</script>` end-tag concern (which would prematurely
// terminate the tag) cannot arise.

type JsonLdScript = {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
};

export function JsonLd({ script }: { script: JsonLdScript }) {
  return <script type="application/ld+json">{JSON.stringify(script)}</script>;
}
