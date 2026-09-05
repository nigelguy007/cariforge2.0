// @polsia:user-owned — Start a project (intake) page.
import type { Metadata } from 'next';
import Link from 'next/link';
import { MissionIntakeForm } from '@/components/custom/missions/mission-intake-form';
import { friendlyLeadReference } from '@/lib/contracts/leads';

export const metadata: Metadata = {
  title: 'Start a project',
  description: 'Describe a business need in plain language to start a new CariForge project.',
};

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ intake?: string; lead?: string }>;
}) {
  // The dashboard's quick-capture textarea hands its text off here via
  // ?intake= rather than creating a project directly — /api/forge/missions'
  // MissionCreate schema requires nine structured fields a single textarea
  // can't satisfy. ?lead= carries the Lead id when this intake converts a
  // public brief, so the reference follows the work into the project.
  const { intake, lead } = await searchParams;
  const reference = lead ? friendlyLeadReference(lead) : null;
  return (
    <div className="app-content space-y-6">
      <header>
        <nav aria-label="Breadcrumb" className="app-small text-[var(--app-text-muted)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/missions" className="app-link">
                All projects
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-[var(--app-text)]" aria-current="page">
              New project
            </li>
          </ol>
        </nav>
        <h1 className="app-h1 mt-2 text-[var(--app-text)]">Start a project</h1>
        <p className="app-body mt-1.5 max-w-prose text-[var(--app-text-muted)]">
          Describe the need as you would to a colleague. CariForge drafts, reviews and advances each
          of the five steps on its own, pulling you in only when a step genuinely needs your
          judgment. The project ends in an approved runnable prototype package — a prototype with
          its plan, operating guide and evidence — not a production deployment.
        </p>
        {reference ? (
          <p className="app-small mt-3 inline-flex items-center gap-2 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-3 py-1.5 text-[var(--app-text)]">
            Converting brief <span className="font-mono">{reference}</span> — its text is pre-filled
            below and the reference stays on the project.
          </p>
        ) : null}
      </header>
      <MissionIntakeForm initialIntake={intake ?? ''} sourceLeadId={lead} />
    </div>
  );
}
