// @polsia:user-owned — landing page served at /. Ported from a supplied
// pixel-exact spec (a single fixed-viewport hero, liquid-glass black
// aesthetic, entrance-motion choreography — originally written for a
// fictional "Vesper.ai") with CariForge's own real name, mark, copy, and
// facts substituted in per the structure — nothing here is fabricated
// marketing copy or invented metrics.
//
// The spec is explicit: "No extra sections, cards, forms, pricing tables,
// or footer beyond the three stats" and desktop is locked to one
// non-scrolling viewport. That leaves nowhere on this route for the
// Oracles/Agents/Stages explanation or the real brief-intake form that used
// to live below the fold here — moved to /how-it-works rather than deleted;
// see that page's own header comment. lib/nav.ts's primary items were
// re-pointed there too so the rest of the site's nav still resolves.
//
// This route also opts OUT of the app's normal global SiteNav/SiteFooter
// (see the `pathname === '/'` check in site-nav.tsx) since it owns its own
// complete header/nav/footer, and forces black regardless of the app's
// light/dark theme toggle (this page predates and ignores that toggle
// entirely, per the spec's own "force black immediately" requirement).

import type { Metadata } from 'next';
import { Instrument_Serif, Inter } from 'next/font/google';
import Link from 'next/link';
import { JsonLd } from '@/components/custom/json-ld';
import { VesperAppearFallback } from '@/components/custom/vesper-home/vesper-appear-fallback';
import { VesperHeader } from '@/components/custom/vesper-home/vesper-header';
import { organization, website } from '@/lib/jsonld';
import { siteDescription, siteName } from '@/lib/site';
import './vesper-home.css';

// This page's own fonts, self-hosted at build time by next/font (bytes
// served from this app's own origin, zero external request at runtime) —
// NOT the site-wide Sora/Manrope @import in custom-style.css, and
// deliberately not next/font on <html> (src/lib/fonts.ts explains why the
// rest of the app avoids that: layout.tsx is framework-owned). This page
// applies the generated font className locally instead, so it doesn't need
// layout.tsx at all. Also sidesteps a real constraint: the app's CSP locks
// style-src to 'self' 'unsafe-inline' with no per-app extension (see
// src/lib/csp.ts) — an external Google Fonts <link>, the spec's own
// documented fallback for a missing self-hosted WOFF2, would simply be
// blocked here. next/font's build-time self-hosting needs no CSP exception
// and satisfies "self-hosted" more literally than the spec's own fallback.
const vhomeInter = Inter({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal'],
  variable: '--vhome-font-inter',
  display: 'swap',
});
const vhomeInstrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['italic'],
  variable: '--vhome-font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { absolute: siteName },
  description: siteDescription,
  alternates: { canonical: '/' },
  openGraph: {
    title: siteName,
    description: siteDescription,
    images: ['/opengraph-image'],
  },
};

function SparkleIcon() {
  return (
    <svg
      width="18"
      height="20"
      viewBox="0 0 24 24"
      fill="white"
      className="vhome-badge-star"
      aria-hidden="true"
    >
      <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
    </svg>
  );
}

function GatesIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="vhome-stat-icon"
      aria-hidden="true"
    >
      <title>Named human gates</title>
      <defs>
        <linearGradient id="vhome-gate-l" x1="3" y1="2" x2="14" y2="22">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#3a3a3a" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id="vhome-gate-r" x1="3" y1="2" x2="14" y2="22">
          <stop offset="0" stopColor="#3a3a3a" stopOpacity="0.38" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <rect x="3.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#vhome-gate-l)" />
      <rect x="13.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#vhome-gate-r)" />
      <rect x="9.2" y="10.9" width="5.6" height="2.2" rx="1.1" fill="#4a4a4a" />
    </svg>
  );
}

function DeliverableIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="vhome-stat-icon"
      aria-hidden="true"
    >
      <title>Runnable software build</title>
      <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="6.2" fill="#ffffff" />
      <path
        d="M12 7.1v7.4M8.15 12.35L12 16.2l3.85-3.85"
        stroke="#111"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg
      width="38"
      height="21"
      viewBox="0 0 40 22"
      fill="none"
      className="vhome-stat-icon"
      aria-hidden="true"
    >
      <title>Seven specialised agents</title>
      <circle cx="10.2" cy="11" r="9.2" fill="#2b2b2b" />
      <ellipse cx="10.2" cy="12.1" rx="4.15" ry="3.7" fill="#f4f4f4" />
      <circle cx="8.6" cy="11.4" r="0.7" fill="#1a1a1a" />
      <circle cx="11.8" cy="11.4" r="0.7" fill="#1a1a1a" />
      <circle cx="20.2" cy="11" r="9.2" fill="#ffffff" />
      <circle cx="18.4" cy="10.4" r="1.7" fill="#111111" />
      <circle cx="22" cy="10.4" r="1.7" fill="#111111" />
      <ellipse cx="20.2" cy="13.2" rx="1.1" ry="0.7" fill="#111111" />
      <path
        d="M17.4 15.4c1 1.1 4.4 1.1 5.4 0"
        stroke="#111111"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="30.2" cy="11" r="9.2" fill="#f26b1d" />
      <text x="30.2" y="15.1" fontSize="12.5" fontWeight="700" textAnchor="middle" fill="#ffffff">
        e
      </text>
    </svg>
  );
}

export default function Home() {
  return (
    <div className={`vhome-root ${vhomeInter.variable} ${vhomeInstrumentSerif.variable}`}>
      <JsonLd script={organization} />
      <JsonLd script={website} />

      <div className="vhome-grain" />
      <div className="vhome-hero-photo" />

      <div className="vhome-page">
        <VesperHeader />

        <main className="vhome-hero" id="top">
          <div className="vhome-hero-copy">
            <span
              className="vhome-badge vhome-appear vhome-appear--pop"
              style={{ ['--vhome-d' as string]: '0.22s' }}
            >
              <SparkleIcon />
              EU AI Act &middot; Article 12 &amp; 14 ready
            </span>

            <h1 className="vhome-h1">
              <span
                className="vhome-headline-line vhome-appear vhome-appear--mask"
                style={{ ['--vhome-d' as string]: '0.42s' }}
              >
                Software the <em>AI</em>
              </span>
              <span
                className="vhome-headline-line vhome-appear vhome-appear--mask"
                style={{ ['--vhome-d' as string]: '0.62s' }}
              >
                can&rsquo;t sign off on.
              </span>
            </h1>

            <p
              className="vhome-lede vhome-appear vhome-appear--soft"
              style={{
                ['--vhome-d' as string]: '0.82s',
                animationDuration: '1.25s',
              }}
            >
              {siteName} turns a one-line business brief into a runnable software build &mdash; and
              never releases it without a named human approving every stage.
            </p>

            <div className="vhome-hero-actions">
              <Link
                href="/how-it-works#front-door"
                className="vhome-btn vhome-btn-solid vhome-hero-btn vhome-hero-btn-solid vhome-appear vhome-appear--btn"
                style={{ ['--vhome-d' as string]: '0.96s' }}
              >
                Submit a brief
              </Link>
              <Link
                href="/how-it-works#council"
                className="vhome-btn vhome-btn-ghost vhome-hero-btn vhome-hero-btn-ghost vhome-appear vhome-appear--side"
                style={{ ['--vhome-d' as string]: '1.10s' }}
              >
                Meet The Oracles
              </Link>
            </div>
          </div>
        </main>

        <footer className="vhome-stats">
          <span
            className="vhome-stat vhome-appear vhome-appear--stat"
            style={{ ['--vhome-d' as string]: '1.12s' }}
          >
            <GatesIcon />5 named human gates, every stage
          </span>
          <span
            className="vhome-stat vhome-appear vhome-appear--stat"
            style={{ ['--vhome-d' as string]: '1.28s' }}
          >
            <DeliverableIcon />
            Runnable repo, not a slide deck
          </span>
          <span
            className="vhome-stat vhome-appear vhome-appear--stat"
            style={{ ['--vhome-d' as string]: '1.44s' }}
          >
            <AgentsIcon />7 specialised agents run the pipeline
          </span>
        </footer>
      </div>

      <VesperAppearFallback />
    </div>
  );
}
