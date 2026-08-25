// @polsia:user-owned — typography choices for CARI Forge.
//
// We deliberately use Google Fonts via a CSS @import in custom-style.css
// rather than next/font, because src/app/layout.tsx is framework-owned and
// `next/font`'s `.variable` class has to be applied to a parent element
// (typically <html>) for the CSS variables to cascade. We register the
// intended display/body font families here as a single source of truth so
// the brand_tokens slot in globals.css and the @import in custom-style.css
// stay aligned when typography is tuned.

// Display font — used for headlines, lede, eyebrow numerals, and large titles.
// Sora: geometric humanist with a slight forward lean; reads premium at scale
// without the obvious-sans look of Inter.
export const fontDisplayFamily = ['"Sora"', '"Inter"', 'ui-sans-serif', 'system-ui'] as const;

// Body font — used for paragraphs, form labels, table copy, dashboard chrome.
// Manrope: open humanist sans with distinctive counters; pairs well with Sora
// without competing on visual weight.
export const fontBodyFamily = ['"Manrope"', '"Inter"', 'ui-sans-serif', 'system-ui'] as const;
