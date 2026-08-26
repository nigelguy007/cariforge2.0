// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'CARI Forge';
export const siteDescription =
  'Council-reviewed, human-approved, audit-ready software from a one-line brief.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
// CARI Forge: deep emerald/rainforest-green field paired with a vivid
// emerald accent (mirrors --brand-h=152, --brand-c=0.13, --brand-l=0.42 on
// the oklch side — computed via the standard OKLCH->sRGB conversion, not
// eyeballed). The OG/social background is a pale sage-mint field; the
// foreground is dark forest-green ink for highest contrast against the
// lighter background; the accent in the generated image is the emerald
// engine at the seed's own lightness step.
export const brandVisual = {
  /** PWA browser-UI / status-bar color — CARI Forge emerald engine. */
  themeColor: '#006025',
  /** PWA splash + install background — pale sage-mint field. */
  backgroundColor: '#c9e7cf',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#c9e7cf',
    foreground: '#003f19',
    /** Second line under the site name; '' hides it. */
    tagline: 'Council-reviewed software for regulated buyers.',
  },
} as const;
