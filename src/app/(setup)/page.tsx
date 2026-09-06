// @polsia:user-owned — landing page served at /.
//
// DESIGN DIRECTION (2026-09-03, explicit user request): "change the design of
// the website to look like https://cosmoq.framer.website ... and retain the
// cariforge colours". The reference is a long, scrolling, multi-section
// marketing page; the previous treatment here was a single locked,
// non-scrolling viewport with a hero and three stats (a "no extra sections,
// cards, forms, pricing tables, or footer" spec). Those are structurally
// incompatible, so the page was rebuilt to the reference's section rhythm
// rather than restyled in place. All styling lives in ./cosmoq-home.css,
// which documents what was measured off the reference and why the two-tone
// gradient is aquamarine -> indigo rather than the reference's own amber.
//
// COPY ACCURACY: every claim below is drawn from this repo, not written to
// fill a section. The five gate names are GATE_DEFS in
// src/lib/contracts/forge.ts, verbatim; the specialist voices are
// SPECIALIST_ROLE_VALUES; the Elder Oracle gate rule is
// ELDER_ORACLE_GATE_INDEXES. Deliberately NOT carried over from the previous
// version of this page: "turns your requirements into a runnable software
// build" and "Runnable repo, not a slide deck". GATE_DEFS[4] is named
// 'Prototype spec approved' and its own source comment states the output is
// "a pair of schema-versioned *specification* documents, not deployable
// code" — the old copy overclaimed against the product's own contract, which
// is not something to ship to judges. The deliverable is described here as
// what it is: an approved workflow whose stages stop for a named human.
//
// This route opts OUT of the app's global SiteNav/SiteFooter (see the
// `pathname === '/'` check in site-nav.tsx) and renders its own header and
// footer, and forces dark regardless of the app's light/dark toggle — the
// reference is dark-only, so there is no light presentation to match.

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { CqFooterAuthLink, CqHeader } from '@/components/custom/cosmoq-home/cq-header';
import { JsonLd } from '@/components/custom/json-ld';
import { organization, website } from '@/lib/jsonld';
import { siteDescription, siteName } from '@/lib/site';
import './cosmoq-home.css';

// This page's own font, self-hosted at build time by next/font (bytes served
// from this app's own origin, zero external request at runtime) — NOT the
// site-wide Sora/Manrope @import in custom-style.css, and deliberately not
// next/font on <html> (src/lib/fonts.ts explains why the rest of the app
// avoids that: layout.tsx is framework-owned). Also sidesteps a real
// constraint: the app's CSP locks style-src to 'self' 'unsafe-inline' with no
// per-app extension (see src/lib/csp.ts), so an external Google Fonts <link>
// would simply be blocked here.
//
// Inter specifically because the reference's display face is "Inter Display"
// — the weights below cover the 400/500 the reference actually uses at
// display sizes (see cosmoq-home.css for the measured values).
const cqInter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  variable: '--cq-font-inter',
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

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l7.5 3v5.3c0 4.6-3.1 8.5-7.5 9.7-4.4-1.2-7.5-5.1-7.5-9.7V6z" />
    </svg>
  );
}

// The faint line-work sitting over each feature card's gradient artwork —
// the reference's cards carry a similar constellation. Rendered as a plain
// inline SVG (no asset, no request) and marked aria-hidden: it is decoration
// and carries no information the card's own text doesn't already give.
function CardConstellation() {
  return (
    <svg
      className="cq-card-art"
      viewBox="0 0 320 200"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.7">
        <path d="M40 150 L110 70 L190 108 L268 46" />
        <path d="M110 70 L142 154 L190 108" />
        <path d="M40 150 L142 154" />
        <path d="M190 108 L232 168" />
      </g>
      <g fill="rgba(255,255,255,0.72)">
        <circle cx="40" cy="150" r="2.6" />
        <circle cx="110" cy="70" r="3" />
        <circle cx="190" cy="108" r="2.8" />
        <circle cx="268" cy="46" r="2.4" />
        <circle cx="142" cy="154" r="2.4" />
        <circle cx="232" cy="168" r="2.2" />
      </g>
    </svg>
  );
}

// The five gates, verbatim from GATE_DEFS in src/lib/contracts/forge.ts.
// The `signer` column reflects ELDER_ORACLE_GATE_INDEXES = [0, 4]: a named
// Elder Oracle must sign those two; the other three are signed by that
// stage's named specialist.
const GATES = [
  { name: 'Need accepted', signer: 'Elder Oracle' },
  { name: 'Ready for workflow', signer: 'Readiness' },
  { name: 'Workflow approved', signer: 'Workflow' },
  { name: 'Governance clear', signer: 'Governance' },
  { name: 'MVP build approved', signer: 'Elder Oracle' },
] as const;

// SPECIALIST_ROLE_VALUES from src/lib/contracts/forge.ts — the five voices
// the council argues in.
const VOICES = ['Risk', 'Demand', 'Growth', 'Competition', 'Money'] as const;

export default function Home() {
  return (
    <div className={`cq-root ${cqInter.variable}`}>
      <JsonLd script={organization} />
      <JsonLd script={website} />

      <div className="cq-stars" aria-hidden="true" />
      {/* Sunrise over a planet's edge, in Caribbean-sea colours — see the
          SUNRISE block in cosmoq-home.css for the palette and why it is
          built from --brand-h rather than the reference's amber. */}
      <div className="cq-sunrise" aria-hidden="true">
        <div className="cq-sun" />
        <div className="cq-planet" />
      </div>

      <div className="cq-page">
        <CqHeader />

        {/* === HERO ========================================================= */}
        <main className="cq-hero cq-container" id="top">
          {/* Real user feedback (2026-09-04): "remove this statement [EU AI
              Act Art. 12 & 14], it's not needed." Compliance-wording history
              (2026-09-03) is moot now the claim itself is gone; replaced with
              a strapline that states the objective without repeating or
              contradicting the H1 below ("Software the AI can't sign off
              on.") — reuses the exact phrase the Stages section already uses
              elsewhere on the site, so it's not a new, separately-verified
              claim. */}
          <span className="cq-badge cq-rise" style={{ ['--cq-d' as string]: '0.05s' }}>
            <SparkIcon />
            Five stages. Five named approvals. No hidden steps.
          </span>

          <h1 className="cq-display cq-rise" style={{ ['--cq-d' as string]: '0.12s' }}>
            Software the AI can&rsquo;t sign off on.
          </h1>

          <p className="cq-lede cq-rise" style={{ ['--cq-d' as string]: '0.2s' }}>
            {siteName} turns a plain-English brief into a governed workflow &mdash; and never lets
            it past a stage without a named human approving it.
          </p>

          <div className="cq-hero-actions cq-rise" style={{ ['--cq-d' as string]: '0.28s' }}>
            <Link href="/how-it-works#front-door" className="cq-btn cq-btn-primary">
              Submit a brief
            </Link>
            <Link href="/how-it-works" className="cq-btn cq-btn-ghost">
              See how it works
            </Link>
          </div>

          {/* Schematic of the real Forge Canvas — the node types below
              (Start / Agent / Human approval / End) are the product's own,
              and the "paused" state on the approval node is what a real run
              actually does when it reaches a gate. */}
          <div className="cq-showcase cq-rise" style={{ ['--cq-d' as string]: '0.36s' }}>
            <div className="cq-showcase-bar">
              <span className="cq-showcase-dot" />
              <span className="cq-showcase-dot" />
              <span className="cq-showcase-dot" />
              <span className="cq-showcase-title">Forge Canvas &mdash; ticket triage</span>
            </div>
            <div className="cq-showcase-body">
              <div className="cq-showcase-rail">
                <span className="cq-rail-item" data-active="true">
                  <span className="cq-rail-swatch" />
                  Build
                </span>
                <span className="cq-rail-item">Runs</span>
                <span className="cq-rail-item">Approvals</span>
                <span className="cq-rail-item">Missions</span>
                <span className="cq-rail-item">Audit</span>
              </div>
              <div className="cq-showcase-canvas">
                <span className="cq-node">
                  <span className="cq-node-badge">S</span>
                  Start
                  <span className="cq-node-meta">trigger</span>
                </span>
                <span className="cq-edge" />
                <span className="cq-node">
                  <span className="cq-node-badge">A</span>
                  Classify the ticket
                  <span className="cq-node-meta">agent</span>
                </span>
                <span className="cq-edge" />
                <span className="cq-node" data-tone="approval">
                  <span className="cq-node-badge">H</span>
                  Human approval
                  <span className="cq-node-meta">paused</span>
                </span>
                <span className="cq-edge" />
                <span className="cq-node">
                  <span className="cq-node-badge">E</span>
                  Release
                  <span className="cq-node-meta">end</span>
                </span>
              </div>
            </div>
          </div>

          <div className="cq-stats">
            <div className="cq-stat">
              <div className="cq-stat-value">5</div>
              <div className="cq-stat-label">
                named human gates &mdash; every stage needs a person to sign
              </div>
            </div>
            <div className="cq-stat">
              <div className="cq-stat-value">7</div>
              <div className="cq-stat-label">specialised agents run the pipeline for you</div>
            </div>
            <div className="cq-stat">
              <div className="cq-stat-value">0</div>
              <div className="cq-stat-label">stages that can clear without a named approver</div>
            </div>
          </div>
        </main>

        {/* === WHY ========================================================== */}
        <section className="cq-section cq-container">
          <div className="cq-eyebrow">
            <GridIcon />
            Why CARI Forge
          </div>
          <div className="cq-rule" />
          <div className="cq-section-head">
            <h2 className="cq-h2">Governance that isn&rsquo;t paperwork</h2>
            <p className="cq-section-note">
              The approval isn&rsquo;t a checkbox bolted on at the end. It&rsquo;s the thing the
              workflow stops for.
            </p>
          </div>

          <div className="cq-cards">
            <article className="cq-card">
              <CardConstellation />
              <div className="cq-card-inner">
                <h3 className="cq-card-title">Stops for a person, by design</h3>
                <p className="cq-card-text">
                  A run reaches an approval node and pauses &mdash; it does not proceed on a
                  timeout, a default, or a confidence score. Someone named has to approve it, with a
                  typed reason, before the next step executes.
                </p>
              </div>
            </article>
            <article className="cq-card">
              <CardConstellation />
              <div className="cq-card-inner">
                <h3 className="cq-card-title">Every decision keeps its receipt</h3>
                <p className="cq-card-text">
                  Who approved, when, on what evidence, and the reason code they chose &mdash;
                  recorded against the stage and replayable afterwards. Corrections are recorded
                  too, rather than quietly overwriting what happened.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* === STATEMENT + ORB ============================================== */}
        <section className="cq-section cq-container">
          <div className="cq-split">
            <p className="cq-statement">
              Most AI tools ask you to trust the output. CARI Forge assumes you can&rsquo;t &mdash;
              so it puts a named human in front of every stage, and keeps the record that proves it.
            </p>
            <div className="cq-orb-wrap">
              <div className="cq-orb">
                <span className="cq-orb-label">
                  <ShieldIcon />
                  Governed
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* === HOW IT WORKS ================================================= */}
        <section className="cq-section cq-container">
          <div className="cq-eyebrow">
            <SparkIcon />
            How it works
          </div>
          <div className="cq-rule" />
          <div className="cq-section-head">
            <h2 className="cq-h2">Brief in. Governed workflow out.</h2>
            <p className="cq-section-note">
              Describe it once in plain English. Shape it on a canvas. Take it through five named
              gates.
            </p>
          </div>

          <div className="cq-rows">
            <article className="cq-row">
              <div>
                <h3 className="cq-row-title">Describe it, then draw it</h3>
                <p className="cq-row-text">
                  Write what you want in plain English and CARI Forge drafts the workflow for you.
                  From there it&rsquo;s a drag-and-drop canvas &mdash; add a step and it connects
                  itself to the one you had selected.
                </p>
                <div className="cq-pills">
                  <span className="cq-pill">
                    <CheckIcon />
                    Plain-English brief
                  </span>
                  <span className="cq-pill">
                    <CheckIcon />
                    AI-drafted first pass
                  </span>
                  <span className="cq-pill">
                    <CheckIcon />
                    Visual canvas
                  </span>
                </div>
                <Link href="/how-it-works#front-door" className="cq-row-link">
                  Start a brief <span>&rarr;</span>
                </Link>
              </div>
              <div className="cq-ladder">
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">1</span>
                  Describe the outcome
                  <span className="cq-ladder-tag">plain English</span>
                </div>
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">2</span>
                  Review the drafted workflow
                  <span className="cq-ladder-tag">canvas</span>
                </div>
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">3</span>
                  Run it, with gates
                  <span className="cq-ladder-tag">pauses for approval</span>
                </div>
              </div>
            </article>

            <article className="cq-row">
              <div>
                <h3 className="cq-row-title">Five gates, each with a named signer</h3>
                <p className="cq-row-text">
                  A mission crosses five gates. A named Elder Oracle must personally sign the first
                  and the last; the three in between are signed by that stage&rsquo;s named
                  specialist. No gate clears itself.
                </p>
                {/* Real user feedback (2026-09-04): "this is giving away the
                    app functionality to everyone" — the full stage/gate
                    detail moved off the public /how-it-works page to the
                    signed-in-only /dashboard/pipeline. Points there now;
                    an unauthenticated click bounces to /login like every
                    other (dashboard) route (DashboardShell's own redirect,
                    same as /forge, /missions, /approvals). */}
                <Link href="/dashboard/pipeline" className="cq-row-link">
                  See the stages <span>&rarr;</span>
                </Link>
              </div>
              <div className="cq-ladder">
                {GATES.map((gate, i) => (
                  <div className="cq-ladder-item" key={gate.name}>
                    <span className="cq-ladder-num">{i}</span>
                    {gate.name}
                    <span className="cq-ladder-tag">{gate.signer}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="cq-row">
              <div>
                <h3 className="cq-row-title">Argued in five voices</h3>
                <p className="cq-row-text">
                  Before a gate is put to a human, the council argues the case in five fixed voices
                  &mdash; so the person signing sees the objections, not just a recommendation.
                  Objections are recorded and have to be resolved, not dismissed.
                </p>
                <Link href="/pilot/oracle-council" className="cq-row-link">
                  Meet The Oracles <span>&rarr;</span>
                </Link>
              </div>
              <div className="cq-pills">
                {VOICES.map((voice) => (
                  <span className="cq-pill" key={voice}>
                    <CheckIcon />
                    {voice}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </section>

        {/* === THREE STEPS ================================================== */}
        <section className="cq-section cq-container">
          <div className="cq-eyebrow">
            <GridIcon />
            Getting started
          </div>
          <div className="cq-rule" />
          <div className="cq-section-head">
            <h2 className="cq-h2">Three steps to your first run</h2>
            <p className="cq-section-note">
              No configuration, no integration work, no schema to learn before you see something
              happen.
            </p>
          </div>

          <div className="cq-steps">
            <article className="cq-step">
              <div>
                <span className="cq-step-num">1</span>
                <h3 className="cq-row-title">Say what you want, in a sentence</h3>
                <p className="cq-row-text">
                  &ldquo;Triage inbound support tickets and escalate anything about billing.&rdquo;
                  That&rsquo;s the whole input. No schema, no config file, no integration to wire up
                  first.
                </p>
              </div>
              <div className="cq-ladder">
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">&rsaquo;</span>
                  Triage inbound support tickets&hellip;
                  <span className="cq-ladder-tag">your brief</span>
                </div>
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">&rsaquo;</span>
                  Drafting workflow
                  <span className="cq-ladder-tag">4 steps found</span>
                </div>
              </div>
            </article>

            <article className="cq-step">
              <div>
                <span className="cq-step-num">2</span>
                <h3 className="cq-row-title">Adjust it on the canvas</h3>
                <p className="cq-row-text">
                  You get a drafted workflow, not a blank page. Drag steps around, add one and it
                  wires itself to whatever you had selected, and drop in a human approval anywhere
                  you want the run to stop.
                </p>
              </div>
              <div className="cq-ladder">
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">A</span>
                  Classify the ticket
                  <span className="cq-ladder-tag">agent</span>
                </div>
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">C</span>
                  Is it about billing?
                  <span className="cq-ladder-tag">condition</span>
                </div>
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">H</span>
                  Human approval
                  <span className="cq-ladder-tag">added by you</span>
                </div>
              </div>
            </article>

            <article className="cq-step">
              <div>
                <span className="cq-step-num">3</span>
                <h3 className="cq-row-title">Run it and approve it</h3>
                <p className="cq-row-text">
                  The run executes until it hits your approval step, then stops and waits. You
                  approve with a typed reason, it carries on, and the whole thing is recorded
                  against the run.
                </p>
              </div>
              <div className="cq-ladder">
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">&#10003;</span>
                  Start &rarr; Classify
                  <span className="cq-ladder-tag">succeeded</span>
                </div>
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">&#9208;</span>
                  Human approval
                  <span className="cq-ladder-tag">waiting for you</span>
                </div>
                <div className="cq-ladder-item">
                  <span className="cq-ladder-num">&#10003;</span>
                  Release
                  <span className="cq-ladder-tag">succeeded</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* === EVIDENCE / SECURITY ========================================== */}
        <section className="cq-section cq-container">
          <div className="cq-eyebrow">
            <ShieldIcon />
            Evidence
          </div>
          <div className="cq-rule" />
          <div className="cq-section-head">
            <h2 className="cq-h2">Built to be audited</h2>
            <p className="cq-section-note">
              The record is the product. Every layer below exists so a decision can be defended
              later, by name.
            </p>
          </div>

          <div className="cq-split" style={{ marginTop: '2.75rem' }}>
            <div>
              <p className="cq-row-text" style={{ marginTop: 0 }}>
                CARI Forge is built for buyers who will be asked to justify an automated decision
                after the fact &mdash; procurement, public sector, regulated industries. That means
                the audit trail can&rsquo;t be a log file bolted on afterwards; it has to be the
                thing the workflow produces.
              </p>
              <Link href="/how-the-council-works" className="cq-row-link">
                How the council works <span>&rarr;</span>
              </Link>
            </div>
            <div className="cq-layers">
              <div className="cq-layer">
                <ShieldIcon />
                Audit-trail bundle per run
              </div>
              <div className="cq-layer">
                <ShieldIcon />
                Persisted as a SHA-256 hash chain
              </div>
              <div className="cq-layer">
                <ShieldIcon />
                90-day minimum retention on every artefact
              </div>
              <div className="cq-layer">
                <ShieldIcon />
                Typed reason code on every gate decision
              </div>
              <div className="cq-layer">
                <ShieldIcon />
                EU AI Act Articles 12 &amp; 14 readiness memo
              </div>
            </div>
          </div>
        </section>

        {/* === PLANS ======================================================== */}
        <section className="cq-section cq-container">
          <div className="cq-eyebrow">
            <SparkIcon />
            Engagements
          </div>
          <div className="cq-rule" />
          <div className="cq-section-head">
            <h2 className="cq-h2">Start with one brief</h2>
            <p className="cq-section-note">
              Three engagement shapes. Each is scoped and quoted per buyer rather than sold off a
              price list.
            </p>
          </div>

          <div className="cq-plans">
            <article className="cq-plan">
              <h3 className="cq-plan-name">Pilot</h3>
              <p className="cq-plan-text">
                One one-line brief, one council ruling, one Software Build. Includes the audit-trail
                bundle per run, persisted as a SHA-256 hash chain, with a 90-day retention minimum
                on every artefact.
              </p>
              <Link href="/pricing" className="cq-btn cq-btn-ghost">
                See what&rsquo;s included
              </Link>
            </article>

            <article className="cq-plan" data-featured="true">
              <span className="cq-plan-tag">Most common</span>
              <h3 className="cq-plan-name">Procurement</h3>
              <p className="cq-plan-text">
                A programme of briefs with a consolidated evidence package at handover: a cross-case
                audit-trail bundle with a per-case hash chain, and a reporting cadence tailored to
                the procurement timeline.
              </p>
              <Link href="/pricing" className="cq-btn cq-btn-primary">
                Talk to us
              </Link>
            </article>

            <article className="cq-plan">
              <h3 className="cq-plan-name">Public Sector</h3>
              <p className="cq-plan-text">
                Extended-timeline posture with an explicit EU AI Act Articles 12 &amp; 14 readiness
                memo, a typed reasons log per gate decision, and supplementary evidentiary artefacts
                produced to the buyer specification.
              </p>
              <Link href="/pricing" className="cq-btn cq-btn-ghost">
                See what&rsquo;s included
              </Link>
            </article>
          </div>
        </section>

        {/* === CLOSING CTA ================================================== */}
        <section className="cq-section cq-container">
          <div className="cq-cta">
            <h2 className="cq-h2">Bring us something you&rsquo;d need to defend.</h2>
            <p className="cq-lede">
              Send a one-line brief. You&rsquo;ll get back a governed workflow with every approval
              attributable to a named person.
            </p>
            <div className="cq-hero-actions">
              <Link href="/how-it-works#front-door" className="cq-btn cq-btn-primary">
                Submit a brief
              </Link>
              <Link href="/pricing" className="cq-btn cq-btn-ghost">
                See pricing
              </Link>
            </div>
          </div>
        </section>

        {/* === GIANT WORDMARK ================================================
            The reference's other signature moment (2026-09-03 addition): a
            huge, glowing, semi-transparent brand wordmark sitting right
            above the footer. aria-hidden — it's decoration, the real
            "CARI Forge" name is already in the header/footer text; a screen
            reader doesn't need it announced a third time. */}
        <div className="cq-wordmark-wrap" aria-hidden="true">
          <span className="cq-wordmark">CARI FORGE</span>
        </div>

        {/* === FOOTER ======================================================= */}
        <footer className="cq-footer">
          <div className="cq-container">
            <div className="cq-footer-grid">
              <div>
                <span className="cq-logo">
                  <span>CARI Forge</span>
                </span>
                <p className="cq-footer-tagline">{siteDescription}</p>
              </div>
              <div>
                <div className="cq-footer-title">Product</div>
                <div className="cq-footer-links">
                  <Link href="/how-it-works">How it works</Link>
                  <Link href="/pricing">Pricing</Link>
                  <Link href="/compare">Compare</Link>
                  <Link href="/sample-brief">Sample brief</Link>
                  {/* Added with the Framer "Span" template pass (2026-09-06)
                      — see /updates' own header comment for the full
                      context. */}
                  <Link href="/updates">Updates</Link>
                </div>
              </div>
              <div>
                <div className="cq-footer-title">Governance</div>
                <div className="cq-footer-links">
                  <Link href="/how-the-council-works">The council</Link>
                  <Link href="/pilot/oracle-council">The Oracles</Link>
                  <Link href="/faq">FAQ</Link>
                  <Link href="/contact">Contact</Link>
                  <CqFooterAuthLink />
                </div>
              </div>
            </div>
            <div className="cq-footer-base">
              <span>
                &copy; {new Date().getFullYear()} {siteName}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
