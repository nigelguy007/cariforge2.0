// @polsia:user-owned — crawl rules merged into /robots.txt (robots.ts is
// framework-owned). Applied only when the deploy is indexable (SEO_INDEXABLE).
export const robotsConfig = {
  /** Paths to keep out of search even when indexable. These are session-gated
   *  zones or programmatic surface area — burning crawl budget on them wastes
   *  discovery cycles and surfaces endpoints that aren't useful to index. */
  disallow: ['/admin/', '/dashboard', '/api/', '/missions'] as string[],
  /** Optional crawl-delay (seconds) for the default user-agent. */
  crawlDelay: undefined as number | undefined,
};
