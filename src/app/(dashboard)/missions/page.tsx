// @polsia:user-owned — Mission list page (Server Component shell).
import type { Metadata } from 'next';
import { MissionList } from '@/components/custom/missions/mission-list';

export const metadata: Metadata = {
  title: 'Missions',
  description:
    'Capture plain-English organisational needs as governed, testable software-delivery missions.',
};

export default function MissionsIndexPage() {
  return (
    <section className="container-page py-section">
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Mission Control</p>
        <h1 className="text-h1 text-foreground">Missions</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Every mission is an attested, versioned journey through five named human gates with typed
          reason codes and an exportable evidence trail.
        </p>
      </header>
      <div className="mt-8">
        <MissionList />
      </div>
    </section>
  );
}
