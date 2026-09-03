// @polsia:user-owned — the CARI Forge logo mark, as an inline SVG component
// so it renders crisply wherever it's used (nav bars, drawers) without an
// extra image request. Same artwork as src/app/icon.svg (the favicon/PWA
// icon) — kept in sync deliberately; if the mark changes, update both.
//
// 2026-09-03: replaced the earlier hand-drawn "anvil + spark" mark
// (self-styled via currentColor, meant to sit inside a coloured tile) with
// the supplied logo file. This one is a complete, self-contained square
// icon — its own black background, coloured ring and mark already baked
// in — so it's rendered directly, not wrapped in another background tile
// the way the old mark needed.

export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="CARI Forge mark"
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="#0a0a0a" />
      <circle
        cx="32"
        cy="32"
        r="23"
        fill="none"
        stroke="#1fb8a6"
        strokeWidth="8"
        pathLength={360}
        strokeDasharray="53 4 53 4 53 4 53 4 53 76"
        strokeDashoffset="318"
      />
      <g stroke="#e8b44c" strokeWidth="8">
        <line x1="29" y1="18" x2="29" y2="46" />
        <line x1="25" y1="22" x2="43" y2="22" />
        <line x1="25" y1="33" x2="40" y2="33" />
      </g>
    </svg>
  );
}
