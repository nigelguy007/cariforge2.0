// @polsia:user-owned — /compare client island. Loads the alternatives table
// from /api/compare through apiFetch + the shared Compare contract, then
// renders the assessment note and one table: category of alternative,
// named examples, and where each falls short for a Caribbean buyer. The
// CARIForge row is visually distinguished. Loading / error guards match the
// council-detail + pricing-tiers pattern.

'use client';

import { useEffect, useState } from 'react';
import { GlassCard, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import { type Alternative, Compare, type Compare as CompareT } from '@/lib/contracts/compare';

function AssessmentNote({ text }: { text: string }) {
  return (
    <GlassPanel
      tone="surface"
      padding="md"
      backdrop="soft"
      role="note"
      aria-label="Assessment note"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700">
        A note from CARIForge
      </p>
      <p className="text-small leading-relaxed text-card-foreground/85">{text}</p>
    </GlassPanel>
  );
}

function AlternativesTable({ rows }: { rows: Alternative[] }) {
  return (
    <GlassCard tone="surface" padding="md" className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {['Alternative', 'Examples', 'Where it falls short for a Caribbean buyer'].map(
                (label) => (
                  <TableHead key={label} className="min-w-[12rem] align-bottom">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {label}
                    </span>
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={
                  row.isSubject ? 'bg-brand-50/60 hover:bg-brand-50/80' : 'hover:bg-muted/40'
                }
              >
                <TableCell className="align-top">
                  <span
                    className={`font-display text-body font-semibold leading-snug ${
                      row.isSubject ? 'text-brand-700' : 'text-foreground'
                    }`}
                  >
                    {row.category}
                  </span>
                </TableCell>
                <TableCell className="align-top text-small leading-relaxed text-card-foreground/85">
                  {row.examples}
                </TableCell>
                <TableCell
                  className={`align-top text-small leading-relaxed ${
                    row.isSubject ? 'font-semibold text-foreground' : 'text-card-foreground/85'
                  }`}
                >
                  {row.position}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  );
}

function TableSkeleton() {
  return (
    <GlassCard tone="surface" padding="md">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </GlassCard>
  );
}

export function CompareMatrix() {
  const [data, setData] = useState<CompareT | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/compare', { schema: Compare })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the comparison.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <GlassPanel tone="surface" padding="md">
        <p className="text-small text-destructive">{loadError}</p>
      </GlassPanel>
    );
  }

  if (!data) return <TableSkeleton />;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6" aria-labelledby="compare-table">
        <GlassSectionHeader
          eyebrow="The alternatives"
          title="What a Caribbean buyer weighs CARIForge against."
          lede="Four kinds of alternative, with named examples of each, and where each falls short for a Caribbean buyer."
        />
        <h2 id="compare-table" className="sr-only">
          Alternatives to CARIForge
        </h2>
        <AlternativesTable rows={data.rows} />
        <AssessmentNote text={data.disclaimer} />
      </section>
    </div>
  );
}
