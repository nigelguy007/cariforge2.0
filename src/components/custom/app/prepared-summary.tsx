// @polsia:user-owned — at most three facts CariForge has already prepared
// for the current step (brief, Step 4). Labelled so the reader knows who
// wrote it; rendered as a plain definition list, not a card grid.

import type { SummaryItem } from './use-project-workspace';

export function PreparedSummary({ items }: { items: readonly SummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="prepared-summary-heading" className="app-panel p-5">
      <h2 id="prepared-summary-heading" className="app-caption text-[var(--app-text-muted)]">
        Prepared by CariForge
      </h2>
      <dl className="mt-2 divide-y divide-[var(--app-border)]">
        {items.slice(0, 3).map((item) => (
          <div key={item.label} className="grid gap-0.5 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="app-small text-[var(--app-text-muted)]">{item.label}</dt>
            <dd className="app-body text-[var(--app-text)]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
