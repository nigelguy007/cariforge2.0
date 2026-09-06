// @polsia:user-owned — companion to api-client.ts's own BASE logic (that file
// is framework-owned, so this small helper lives separately). A handful of
// download/export links across the app render a plain <a href="/api/...">
// rather than going through apiFetch (a real HTTP download, not a fetch+JSON
// call), which meant they silently bypassed the same NEXT_PUBLIC_API_URL
// prefix apiFetch already applies. Confirmed as a real bug 2026-09-06: under
// a basePath deployment (this build embedded at www.cariforge.com/888 via a
// dedicated second deployment — see next.user-config.ts), those raw hrefs
// pointed at the WRONG origin-relative path and would 404 through the proxy.
export function apiHref(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  return `${base}${path}`;
}
