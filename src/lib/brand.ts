// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'CARI Forge';
export const siteDescription =
  'Council-reviewed, human-approved, audit-ready software from a one-line brief.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
// CARI Forge: mid-luminance blue/teal field paired with a vivid teal
// accent (mirrors --brand-h=195 on the oklch side). The OG/social
// background is the lighter teal-blue field; the foreground is dark teal
// ink for highest contrast against the lighter background; the accent in
// the generated image is the teal engine.
export const brandVisual = {
  /** PWA browser-UI / status-bar color — CARI Forge teal engine. */
  themeColor: '#1f8faf',
  /** PWA splash + install background — lighter teal-blue field. */
  backgroundColor: '#bfe1ea',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#bfe1ea',
    foreground: '#0e2a36',
    /** Second line under the site name; '' hides it. */
    tagline: 'Council-reviewed software for regulated buyers.',
  },
} as const;
