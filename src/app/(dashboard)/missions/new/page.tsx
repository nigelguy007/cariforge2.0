// @polsia:user-owned — New-mission intake page.
import type { Metadata } from 'next';
import { MissionIntakeForm } from '@/components/custom/missions/mission-intake-form';
import { friendlyLeadReference } from '@/lib/contracts/leads';

export const metadata: Metadata = {
  title: 'Start a mission',
  description:
    'Capture a plain-English organisational need as a new mission in the CARI Forge control plane.',
};

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ intake?: string; lead?: string }>;
}) {
  // R1 (mission pipeline rebuild): the dashboard's quick-capture textarea
  // hands its text off here via ?intake= rather than creating a mission
  // directly — /api/forge/missions' MissionCreate schema requires nine
  // structured attribution fields a single textarea can't satisfy, so this
  // stays a real page composition change, not a loosening of that schema.
  // UX review C1: ?lead= carries the Lead id when this intake converts a
  // public brief, so the CF reference follows the work into the pipeline.
  const { intake, lead } = await searchParams;
  const reference = lead ? friendlyLeadReference(lead) : null;
  return (
    <section className="container-page py-section">
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Mission intake</p>
        <h1 className="text-h1 text-foreground">Start a mission</h1>
        {/* Real user testing feedback (2026-09-04): "Need to explain what
            is start a mission? After you submit your idea do you then have
            to create a mission? It's not clear." Answered directly: this
            is NOT a required next step after a brief — it's the OTHER of
            two alternative paths (the canvas is the other). Only reachable
            from an explicit choice (a brief's "Start a governed mission"
            button, or navigating here directly), never forced. */}
        <p className="mt-2 text-body text-foreground">
          This is separate from — not a required next step after — submitting a brief. It's the
          formal alternative to the visual canvas: instead of building the steps yourself, you
          describe the need once and it goes through five human-gated review stages before anything
          is built.
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Write the need as you would to a colleague: one paragraph, the outcome, the blocker, the
          constraints. The forge will turn it into a governed, testable journey through five human
          gates.
        </p>
        {reference ? (
          // Was `bg-brand-50` — a light-mode-only surface with no dark-mode
          // override, rendering nearly invisible inside this otherwise-dark
          // panel ("a light blue circle not visible" in testing).
          // .glass-inset is the purpose-built nested-panel class fixed for
          // exactly this pattern in an earlier pass.
          <p className="glass-inset mt-3 inline-flex items-center gap-2 px-3 py-1 text-small text-foreground">
            Converting brief <span className="font-mono">{reference}</span> — its text is pre-filled
            below and the reference stays on the mission.
          </p>
        ) : null}
      </header>
      <div className="mt-8">
        <MissionIntakeForm initialIntake={intake ?? ''} sourceLeadId={lead} />
      </div>
    </section>
  );
}
