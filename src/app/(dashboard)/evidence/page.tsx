// @polsia:user-owned — Evidence index page (brief, Step 5). One row per
// project, leading to its evidence record.
import type { Metadata } from 'next';
import { EvidenceIndex } from '@/components/custom/app/evidence-index';

export const metadata: Metadata = {
  title: 'Proof',
  description:
    'The proof record for each project — why it exists, who approved each decision, what information was used, what the solution may do, and what changed.',
};

export default function EvidenceIndexPage() {
  return (
    <div className="app-content space-y-5">
      <header>
        <h1 className="app-h1 text-[var(--app-text)]">Proof</h1>
        <p className="app-body mt-1 text-[var(--app-text-muted)]">
          The record a buyer or auditor would ask for, for each project.
        </p>
      </header>
      <EvidenceIndex />
    </div>
  );
}
