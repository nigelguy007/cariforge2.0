// @polsia:user-owned — header + nav + mobile drawer for the / homepage.
// Client component: owns the mobile-menu open/close state (the only
// interactivity this page needs besides the entrance-motion fallback).

'use client';

import Link from 'next/link';
import * as React from 'react';

const NAV_ITEMS = [
  { label: 'How it works', href: '/how-it-works', appear: 'vhome-appear--scale', d: '0.16s' },
  { label: 'Council', href: '/how-it-works#council', appear: 'vhome-appear--soft', d: '0.28s' },
  { label: 'Stages', href: '/how-it-works#stages', appear: 'vhome-appear--scale', d: '0.40s' },
  { label: 'Oracles', href: '/pilot/oracle-council', appear: 'vhome-appear--soft', d: '0.52s' },
] as const;

function LogoMark() {
  // The real CARI Forge mark (anvil + spark — src/app/icon.svg), rendered
  // white/monochrome for this page instead of its usual teal-on-white tile,
  // matching the spec's "same mark as the logo" favicon convention without
  // inventing a new abstract glyph.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="6" y="22" width="20" height="3" rx="0.5" fill="currentColor" />
      <rect x="11.5" y="17" width="9" height="5" fill="currentColor" />
      <path
        d="M7 14 H22 a3 3 0 0 1 0 3 H21 L19 14 H10 a2.5 2.5 0 0 0 -3 2.5 z"
        fill="currentColor"
      />
      <path d="M16 4 v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 7 l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M21 7 l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function VesperHeader() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    document.body.classList.toggle('vhome-body-menu-open', open);
    return () => {
      document.body.classList.remove('vhome-body-menu-open');
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => {
      if (window.matchMedia('(min-width: 901px)').matches) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="vhome-menu-backdrop"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
      <header className="vhome-header">
        <Link
          href="/"
          aria-label="CARI Forge"
          className="vhome-logo vhome-appear vhome-appear--scale"
          style={{ ['--vhome-d' as string]: '0.08s' }}
        >
          <LogoMark />
          <span>
            CARI Forge<span className="vhome-logo-suffix">.ai</span>
          </span>
        </Link>

        <nav id="site-nav" aria-label="Primary" className="vhome-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`vhome-nav-link vhome-appear ${item.appear}`}
              style={{ ['--vhome-d' as string]: item.d }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href="/how-it-works#front-door"
            className="vhome-btn vhome-btn-solid vhome-appear vhome-appear--scale"
            style={{ ['--vhome-d' as string]: '0.34s' }}
          >
            Submit a brief
          </Link>
          <button
            type="button"
            className="vhome-burger"
            aria-controls="site-nav"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="vhome-burger-bars">
              <span className="vhome-burger-bar" />
              <span className="vhome-burger-bar" />
              <span className="vhome-burger-bar" />
            </span>
          </button>
        </div>
      </header>
    </>
  );
}
