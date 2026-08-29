// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'CARI Forge';
export const siteDescription =
  'Council-reviewed, human-approved, audit-ready software from a one-line brief.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
// CARI Forge: vivid violet accent (mirrors --brand-h=288, --brand-c=0.22,
// --brand-l=0.55 on the oklch side — computed via the standard
// OKLCH->sRGB conversion at each swatch's own step, not eyeballed; this
// file had gone stale through the last two brand-hue changes, keep it in
// sync going forward). The OG/social background is a pale lavender field;
// the foreground is dark violet-ink for highest contrast against the
// lighter background; the accent in the generated image is the brand-500
// violet at the seed's own lightness step.
export const brandVisual = {
  /** PWA browser-UI / status-bar color — CARI Forge violet engine. */
  themeColor: '#724de7',
  /** PWA splash + install background — pale lavender field. */
  backgroundColor: '#edecff',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#edecff',
    foreground: '#1a113d',
    /** Second line under the site name; '' hides it. */
    tagline: 'Council-reviewed software for regulated buyers.',
  },
} as const;
