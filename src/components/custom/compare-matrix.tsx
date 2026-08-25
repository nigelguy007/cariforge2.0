// @polsia:user-owned — /compare client island. Loads the structured
// procurement evaluation from /api/compare through apiFetch + the shared
// Compare contract, then renders a disclaimer banner, a six-row × five-column
// evaluation matrix with semantic evidence chips, a per-criterion explainer
// strip, and a research-notes section with resolved source links. Loading /
// empty / error guards match the council-detail + pricing-tiers pattern.
// Visual treatment: subject row (CARI Forge) is visually distinguished;
// chip tones stay consistent across all six rows so a reader can scan
// capabilities neutrally.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GlassCard, GlassChip, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import {
  type Cell as CellT,
  Compare,
  type Compare as CompareT,
  type Criterion as CriterionT,
  type Rating as RatingT,
  type Source as SourceT,
  type Vendor as VendorT,
} from '@/lib/contracts/compare';

type CompareData = CompareT;
type Vendor = VendorT;
type Criterion = CriterionT;

const SUBJECT_VENDOR_ID = 'cari' as const;

const RATING_CHIP: Record<
  RatingT,
  { label: string; tone: 'brand' | 'muted' | 'destructive' | 'outline' }
> = {
  stronger: { label: 'Stronger', tone: 'brand' },
  comparable: { label: 'Comparable', tone: 'muted' },
  weaker: { label: 'Weaker', tone: 'destructive' },
  unknown: { label: 'Research not yet captured', tone: 'outline' },
};

function RatingChip({ rating }: { rating: RatingT }) {
  const chip = RATING_CHIP[rating];
  return (
    <GlassChip tone={chip.tone} size="sm" className="whitespace-nowrap">
      {chip.label}
    </GlassChip>
  );
}

function cellLookup(cells: CellT[]): Map<string, CellT> {
  const map = new Map<string, CellT>();
  for (const c of cells) map.set(`${c.vendorId}:${c.criterionId}`, c);
  return map;
}

function buildSourceIndex(sources: SourceT[]): Map<string, SourceT> {
  const map = new Map<string, SourceT>();
  for (const s of sources) map.set(s.id, s);
  return map;
}

function SourceLinks({
  sourceIds,
  sources,
  prefix,
}: {
  sourceIds: string[];
  sources: Map<string, SourceT>;
  prefix?: string;
}) {
  if (sourceIds.length === 0) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      {prefix ? `${prefix} ` : ''}
      {sourceIds.map((id, i) => {
        const s = sources.get(id);
        if (!s) return null;
        return (
          <span key={id}>
            <Link href={s.href} target="_blank" rel="noreferrer" className="link-brand">
              [{Number(i) + 1}] {s.label}
            </Link>
            {i < sourceIds.length - 1 ? ' · ' : ''}
          </span>
        );
      })}
    </p>
  );
}

function DisclaimerBanner({ text }: { text: string }) {
  return (
    <GlassPanel
      tone="surface"
      padding="md"
      backdrop="soft"
      role="note"
      aria-label="Matrix disclaimer"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700">
        A note from CARI Forge, before the matrix
      </p>
      <p className="text-small leading-relaxed text-card-foreground/85">{text}</p>
    </GlassPanel>
  );
}

function MatrixTable({
  vendors,
  criteria,
  cells,
  sources,
}: {
  vendors: Vendor[];
  criteria: Criterion[];
  cells: CellT[];
  sources: Map<string, SourceT>;
}) {
  const lookup = cellLookup(cells);
  const isSubject = (v: Vendor) => v.id === SUBJECT_VENDOR_ID;

  return (
    <GlassCard tone="surface" padding="md" className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="align-bottom">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Vendor
                </span>
              </TableHead>
              {criteria.map((c, idx) => (
                <TableHead key={c.id} className="min-w-[18rem] align-bottom">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Criterion № {String(idx + 1).padStart(2, '0')}
                  </p>
                  <p className="mt-1 font-display text-body font-semibold leading-snug text-foreground">
                    {c.label}
                  </p>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow
                key={v.id}
                className={
                  isSubject(v) ? 'bg-brand-50/60 hover:bg-brand-50/80' : 'hover:bg-muted/40'
                }
              >
                <TableCell className="align-top">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`font-display text-caption font-semibold tracking-[0.1em] ${
                        isSubject(v) ? 'text-brand-700' : 'text-muted-foreground'
                      }`}
                    >
                      {isSubject(v) ? 'Subject row' : 'Competitor'}
                    </span>
                    <span className="font-display text-body font-semibold leading-snug text-foreground">
                      {v.fullName}
                    </span>
                    {v.url ? (
                      <Link
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="link-brand text-[11px]"
                      >
                        {v.name} ↗
                      </Link>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">— no URL on file</span>
                    )}
                  </div>
                </TableCell>
                {criteria.map((c) => {
                  const cell = lookup.get(`${v.id}:${c.id}`);
                  if (!cell) {
                    return (
                      <TableCell key={c.id} className="align-top text-small text-muted-foreground">
                        No cell recorded for this pairing.
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={c.id} className="align-top">
                      <div className="flex flex-col gap-2">
                        <RatingChip rating={cell.rating} />
                        <p className="text-small leading-relaxed text-card-foreground/85">
                          {cell.statement}
                        </p>
                        {cell.commentary ? (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {cell.commentary}
                          </p>
                        ) : null}
                        <SourceLinks
                          sourceIds={cell.sourceIds}
                          sources={sources}
                          prefix="Sources:"
                        />
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  );
}

function MatrixSkeleton() {
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

function CriterionExplainer({ criteria }: { criteria: Criterion[] }) {
  return (
    <div className="flex flex-col gap-4">
      <GlassSectionHeader
        eyebrow="§ 02 · What each criterion actually measures"
        title="Read the criterion rather than the chip alone."
        lede="A chip on the matrix above is the headline; the criterion text below is the test a reader actually applies. Open one to read what a row is and is not asserting."
      />
      <GlassCard tone="surface" padding="sm">
        <Accordion type="single" collapsible className="w-full">
          {criteria.map((c, idx) => (
            <AccordionItem
              key={c.id}
              value={c.id}
              className="border-b border-brand-700/20 px-2 last:border-b-0 sm:px-3"
            >
              <AccordionTrigger className="gap-4 py-5 text-left text-h4 font-display tracking-tight text-foreground hover:no-underline">
                <span className="flex items-baseline gap-4">
                  <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
                    № {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1">{c.label}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <p className="max-w-3xl text-body leading-relaxed text-card-foreground/85">
                  {c.whatWeLookFor}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </GlassCard>
    </div>
  );
}

function ResearchNotes({
  notes,
  sources,
}: {
  notes: { id: string; title: string; body: string; sourceIds: string[] }[];
  sources: Map<string, SourceT>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <GlassSectionHeader
        eyebrow="§ 03 · Research notes for this run"
        title="How the matrix was gathered — and what is still missing."
        lede="Each note below records a choice made in this run. The note body is the agent's own commentary; the source links underneath resolve to the citations rendered above. Where a note is empty, the matrix above is the source of truth."
      />
      {notes.length === 0 ? (
        <p className="text-small text-muted-foreground">No research notes published yet.</p>
      ) : (
        <GlassCard tone="surface" padding="sm">
          <Accordion type="single" collapsible className="w-full">
            {notes.map((n) => (
              <AccordionItem
                key={n.id}
                value={n.id}
                className="border-b border-brand-700/20 px-2 last:border-b-0 sm:px-3"
              >
                <AccordionTrigger className="gap-4 py-5 text-left text-h4 font-display tracking-tight text-foreground hover:no-underline">
                  {n.title}
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <p className="max-w-3xl text-body leading-relaxed text-card-foreground/85">
                    {n.body}
                  </p>
                  <Separator className="my-4" />
                  <SourceLinks sourceIds={n.sourceIds} sources={sources} prefix="Notes cite:" />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </GlassCard>
      )}
    </div>
  );
}

export function CompareMatrix() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/compare', { schema: Compare })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the compare matrix.');
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

  if (!data) {
    return (
      <div className="flex flex-col gap-12">
        <MatrixSkeleton />
      </div>
    );
  }

  const sourceIndex = buildSourceIndex(data.sources);

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col gap-6" aria-labelledby="compare-disclaimer">
        <h2 id="compare-disclaimer" className="sr-only">
          Matrix disclaimer
        </h2>
        <DisclaimerBanner text={data.disclaimer} />
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="compare-matrix">
        <GlassSectionHeader
          eyebrow="§ 01 · The matrix"
          title="Six vendors × five criteria, with each cell sourced."
          lede="Subject row first; the rest by alphabetical order. Each cell renders its evidence chip, the plain-language claim, and the source links resolved from the matrix’s source list."
        />
        <MatrixTable
          vendors={data.vendors}
          criteria={data.criteria}
          cells={data.cells}
          sources={sourceIndex}
        />
        <p className="text-small text-muted-foreground">
          The {'"unknown"'} chip on a cell means the research for that pairing has not been captured
          in this run. The cell deliberately reads no claim rather than a guessed rating — see the
          disclaimer at the top of this page.
        </p>
      </section>

      <CriterionExplainer criteria={data.criteria} />

      <ResearchNotes notes={data.notes} sources={sourceIndex} />
    </div>
  );
}
