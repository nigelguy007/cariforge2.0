// @polsia:user-owned — /pilot/oracle-council. Server Component shell that
// exports metadata and mounts the OracleCouncilIndex client island. Pulls
// the mission list through /api/forge/missions so the page stays RSC and
// every datum crosses the data-plane seam.

import type { Metadata } from 'next';
import { JsonLd } from '@/components/custom/json-ld';
import { OracleCouncilIndex } from '@/components/custom/missions/oracle-council-index';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `TAG pilot — Oracle Council — ${siteName}` },
  description:
    'The five named human gates of The Oracles + the Elder Oracle: visible, attributable, enforceable. No specialist or model can skip the gate that closes a TAG Caribbean pilot mission.',
  alternates: { canonical: '/pilot/oracle-council' },
  openGraph: {
    title: `TAG pilot — Oracle Council — ${siteName}`,
    description:
      'Five named human gates of The Oracles + the named Elder Oracle. Gates 0 and 4 require the Elder; every gate requires at least one specialist attester on the handoff.',
    images: ['/opengraph-image'],
  },
};

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteName,
  url: siteUrl,
  description: siteDescription,
  logo: `${siteUrl}/icon.svg`,
  sameAs: [],
} as const;

export default function PilotOracleCouncilPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section relative overflow-hidden">
        <div className="container-page flex flex-col gap-8">
          <header className="flex flex-col gap-3">
            <p className="text-eyebrow text-brand-700">TAG Caribbean pilot · Oracle Council</p>
            <h1 className="text-h1 text-foreground">Five named gates, one Elder Oracle.</h1>
            <p className="max-w-3xl text-body text-muted-foreground">
              The Oracles visible. Every gate has a named human approver. Gates{' '}
              <strong>0 (Need Discovery)</strong> and <strong>4 (Software Build)</strong> can only
              be approved by the appointed Elder Oracle — no specialist or model can skip that
              signature. Every gate also requires at least one specialist attester on the handoff
              before the decision can land.
            </p>
          </header>
          <OracleCouncilIndex />
        </div>
      </section>
    </main>
  );
}
