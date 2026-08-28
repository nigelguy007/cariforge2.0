// @polsia:user-owned — layered parallax aurora backdrop for the signed-in
// product. Gives .glass-panel/.glass-card surfaces something real to blur
// (the actual "liquid glass" reveal — a translucent surface over a flat
// background is indistinguishable from a solid box), with two glow layers
// translating at different rates on scroll for gentle parallax depth.
// Restraint per .impeccable.md: soft brand-tinted glows on the page field,
// never a saturated wash. Respects prefers-reduced-motion (layers render
// statically) and uses transform-only animation on rAF (no layout work).

'use client';

import * as React from 'react';

export function ParallaxAurora() {
  const slow = React.useRef<HTMLDivElement>(null);
  const fast = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (slow.current) slow.current.style.transform = `translate3d(0, ${y * -0.06}px, 0)`;
        if (fast.current) fast.current.style.transform = `translate3d(0, ${y * -0.14}px, 0)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        ref={slow}
        className="absolute -top-40 -left-32 size-[560px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, oklch(0.86 calc(var(--brand-c) * 0.9) var(--brand-h) / 0.28) 0%, transparent 72%)',
        }}
      />
      <div
        ref={fast}
        className="absolute top-1/3 -right-40 size-[480px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, oklch(0.8 calc(var(--brand-c) * 0.7) var(--brand-h) / 0.2) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
