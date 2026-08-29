// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'CARI Forge';
export const siteDescription =
  'Council-reviewed, human-approved, audit-ready software from a one-line brief.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
// CARI Forge: vivid aquamarine accent on a dark field (mirrors
// --brand-h=169, --brand-c=0.19, --brand-l=0.55 for the accent, and the
// .dark.dark --background formula for the dark swatches — computed via
// the standard OKLCH->sRGB conversion at each swatch's own step, not
// eyeballed; this file had gone stale through the last few brand changes,
// keep it in sync going forward). Dark mode is now the site's default
// (see providers.tsx), so the PWA/OG surfaces follow suit: a near-black
// aquamarine-tinted field with the vivid aquamarine as the accent, near-
// white ink for highest contrast.
export const brandVisual = {
  /** PWA browser-UI / status-bar color — CARI Forge aquamarine engine. */
  themeColor: '#00915e',
  /** PWA splash + install background — the same near-black dark-mode field. */
  backgroundColor: '#000602',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#001409',
    foreground: '#eef3f1',
    /** Second line under the site name; '' hides it. */
    tagline: 'Council-reviewed software for regulated buyers.',
  },
} as const;
