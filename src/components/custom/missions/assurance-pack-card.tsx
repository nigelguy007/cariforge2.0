// @polsia:user-owned — Assurance pack card island. Fetches and renders the
// Section-8 assurance pack (business/forge/assurance-pack.ts) for one
// mission — a curated, governance-audience summary, distinct from the raw
// JSON/CSV evidence-trail export above it on the same tab (that dumps every
// row; this assembles the specific fields a risk/compliance reviewer asks
// for, and says plainly where this schema has nothing to report).

'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AssurancePack, type AssurancePackT } from '@/lib/contracts/assurance-pack';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="text-small text-foreground">{children}</div>
    </div>
  );
}

function NotCaptured({ reason }: { reason: string }) {
  return <p className="text-small italic text-muted-foreground">Not captured — {reason}</p>;
}

function PackView({ pack }: { pack: AssurancePackT }) {
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-h4">{pack.mission.name}</p>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-caption font-semibold">
          {pack.recommendation}
        </span>
      </div>

      <Field label="Workflow owner">
        <code className="text-caption">{pack.workflowOwnerUserId}</code>
        {pack.elderOracleUserId && (
          <>
            {' '}
            &middot; Elder Oracle: <code className="text-caption">{pack.elderOracleUserId}</code>
          </>
        )}
      </Field>

      <Field label="Approved use case">
        <p className="whitespace-pre-wrap">{pack.approvedUseCase}</p>
      </Field>

      <Field label="Gate / permission matrix">
        <ul className="flex flex-col gap-1">
          {pack.gateDefinitions.map((g) => (
            <li key={g.gateIndex}>
              <span className="font-semibold">{g.name}</span> ({g.stage}) &mdash; {g.purpose}
            </li>
          ))}
        </ul>
      </Field>

      <Field label={`Human approval & escalation map (${pack.approvals.length})`}>
        {pack.approvals.length === 0 ? (
          <p className="text-muted-foreground">No gate decisions recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pack.approvals.map((a) => (
              <li key={`${a.gateIndex}-${a.at}`}>
                <span className="font-semibold">{a.gateName}</span>: {a.decision} by{' '}
                <code className="text-caption">{a.approverUserId ?? 'unknown'}</code> &mdash;{' '}
                {a.reasonCode} ({a.reasonText})
                {a.controls && (
                  <span className="text-muted-foreground"> — controls: {a.controls}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label={`Objections / edge cases raised (${pack.objections.length})`}>
        {pack.objections.length === 0 ? (
          <p className="text-muted-foreground">None raised on this mission.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pack.objections.map((o) => (
              <li key={`${o.raisedByRole}-${o.raisedAt}`}>
                <span className="font-semibold">{o.raisedByRole}</span>: {o.text}
                {o.resolution && <span className="text-muted-foreground"> — {o.resolution}</span>}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label="Representative test cases and expected outcomes">
        <NotCaptured reason={pack.representativeTestCases.reason} />
      </Field>
      <Field label="Security, privacy and data-retention assessment">
        <NotCaptured reason={pack.securityPrivacyAssessment.reason} />
      </Field>

      <Field label={`Audit trail, hash-chained (${pack.auditTrail.length} entries)`}>
        {pack.auditTrail.length === 0 ? (
          <p className="text-muted-foreground">No audit events recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 font-mono text-caption">
            {pack.auditTrail.slice(0, 5).map((e) => (
              <li key={e.id}>
                {e.at} &middot; {e.event} &middot; hash {e.hash.slice(0, 12)}…
              </li>
            ))}
            {pack.auditTrail.length > 5 && (
              <li className="text-muted-foreground">
                +{pack.auditTrail.length - 5} more — see the full JSON export for the complete
                chain.
              </li>
            )}
          </ul>
        )}
      </Field>

      <p className="text-caption text-muted-foreground">Generated {pack.generatedAt}.</p>
    </div>
  );
}

export function AssurancePackCard({ missionId }: { missionId: string }) {
  const [pack, setPack] = useState<AssurancePackT | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(`/api/forge/missions/${missionId}/assurance-pack`, {
        schema: AssurancePack,
      });
      setPack(result);
    } catch (err) {
      setError((err as Error).message || 'Could not generate the assurance pack.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-card mt-6 space-y-3 rounded-2xl p-6">
      <h3 className="text-h3">Assurance pack</h3>
      <p className="text-small text-muted-foreground">
        A curated summary for governance, risk, and compliance review — named owner, the gate/
        approval map, objections raised, and a hash-chained audit trail, assembled from this
        mission&rsquo;s real records. Two fields this schema has no data source for are reported as
        such, not filled in.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="glass-cta inline-flex items-center rounded-full px-4 py-2 text-body disabled:opacity-60"
        >
          {loading ? 'Generating…' : pack ? 'Regenerate' : 'Generate assurance pack'}
        </button>
        <a
          className="glass-outline-cta inline-flex items-center rounded-full px-4 py-2 text-body"
          href={`/api/forge/missions/${missionId}/assurance-pack`}
          target="_blank"
          rel="noreferrer"
        >
          Open raw JSON
        </a>
      </div>
      {error && <p className="text-small text-destructive">{error}</p>}
      {pack && <PackView pack={pack} />}
    </section>
  );
}
