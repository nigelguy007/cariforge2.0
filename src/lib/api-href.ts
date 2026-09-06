// @polsia:user-owned — a handful of download/export links across the app
// render a plain <a href="/api/..."> rather than going through apiFetch (a
// real HTTP download, not a fetch+JSON call), which meant they silently
// escaped the app's basePath under a subpath deployment. Confirmed as a real
// bug 2026-09-06: this build is also embedded at www.cariforge.com/888 via a
// dedicated second deployment (see next.user-config.ts's NEXT_BASE_PATH) —
// next/link auto-prefixes with the configured basePath, but a raw <a href>
// string does not, so these links 404'd through the proxy.
//
// Deliberately NOT env.ts's NEXT_PUBLIC_API_URL — that var has a different,
// incompatible contract (z.string().url(), an external API origin), not a
// same-origin path prefix; setting it to a bare path like "/888" fails that
// schema's validation (confirmed live). NEXT_PUBLIC_BASE_PATH is a separate,
// unvalidated var read directly here, matching next.user-config.ts's own
// NEXT_BASE_PATH — both must be set to the same value on any deployment
// that also sets NEXT_BASE_PATH, since Next's own basePath config has no
// runtime-readable equivalent this file can reuse directly.
export function apiHref(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${base}${path}`;
}
