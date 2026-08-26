// @polsia:user-owned — entrance-motion plumbing for the / homepage.
// 1. Each .vhome-appear element gets .vhome-is-in added on its own
//    `animationend` (freezing it at its resting state so nothing replays).
// 2. If animations never actually ran (reduced-motion edge cases, a browser
//    that silently drops the animation, etc.), force .vhome-is-in onto
//    every .vhome-appear + .vhome-hero-photo after two animation frames —
//    .vhome-appear's resting opacity is already 1, so this is a fallback
//    for the transform/filter staying stuck mid-animation, not a
//    visibility fix.
// Renders nothing; mount once per page.

'use client';

import { useEffect } from 'react';

export function VesperAppearFallback() {
  useEffect(() => {
    const appearEls = Array.from(document.querySelectorAll('.vhome-appear'));
    const onEnd = (e: Event) => {
      (e.currentTarget as HTMLElement).classList.add('vhome-is-in');
    };
    for (const el of appearEls) {
      el.addEventListener('animationend', onEnd, { once: true });
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const photo = document.querySelector('.vhome-hero-photo');
        const targets = photo ? [...appearEls, photo] : appearEls;
        const anyRunning = targets.some((el) => {
          if (!('getAnimations' in el)) return false;
          const anims = (el as HTMLElement).getAnimations();
          return anims.some((a) => a.playState === 'running' || a.playState === 'finished');
        });
        if (!anyRunning) {
          for (const el of targets) el.classList.add('vhome-is-in');
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      for (const el of appearEls) el.removeEventListener('animationend', onEnd);
    };
  }, []);

  return null;
}
