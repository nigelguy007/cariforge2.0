// @polsia:user-owned — Assurance pack card island. Fetches and renders the
// Section-8 assurance pack (business/forge/assurance-pack.ts) for one
// mission — a curated, governance-audience summary, distinct from the raw
// JSON/CSV evidence-trail export above it on the same tab (that dumps every
// row; this assembles the specific fields a risk/compliance reviewer asks
// for, and says plainly where this schema has nothing to report).

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { apiHref } from '@/lib/api-href';
import { AssurancePack, type AssurancePackT } from '@/lib/contracts/assurance-pack';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="app-caption font-medium text-[var(--app-text-muted)]">{label}</p>
      <div className="app-small text-[var(--app-text)]">{children}</div>
    </div>
  );
}

function NotCaptured({ reason }: { reason: string }) {
  return <p className="app-small italic text-[var(--app-text-muted)]">Not captured — {reason}</p>;
}

function PackView({ pack }: { pack: AssurancePackT }) {
  return (
    <div className="app-panel mt-4 flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="app-h3 text-[var(--app-text)]">{pack.mission.name}</p>
        <span className="app-caption rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-2.5 py-0.5 font-medium text-[var(--app-text)]">
          {pack.recommendation}
        </span>
      </div>

      <Field label="Workflow owner">
        <code className="app-caption">{pack.workflowOwnerUserId}</code>
        {pack.elderOracleUserId && (
          <>
            {' '}
            &middot; Elder Oracle: <code className="app-caption">{pack.elderOracleUserId}</code>
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
              <span className="font-medium">{g.name}</span> ({g.stage}) &mdash; {g.purpose}
            </li>
          ))}
        </ul>
      </Field>

      <Field label={`Human approval & escalation map (${pack.approvals.length})`}>
        {pack.approvals.length === 0 ? (
          <p className="text-[var(--app-text-muted)]">No gate decisions recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pack.approvals.map((a) => (
              <li key={`${a.gateIndex}-${a.at}`}>
                <span className="font-medium">{a.gateName}</span>: {a.decision} by{' '}
                <code className="app-caption">{a.approverUserId ?? 'unknown'}</code> &mdash;{' '}
                {a.reasonCode} ({a.reasonText})
                {a.controls && (
                  <span className="text-[var(--app-text-muted)]"> — controls: {a.controls}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label={`Objections / edge cases raised (${pack.objections.length})`}>
        {pack.objections.length === 0 ? (
          <p className="text-[var(--app-text-muted)]">None raised on this mission.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pack.objections.map((o) => (
              <li key={`${o.raisedByRole}-${o.raisedAt}`}>
                <span className="font-medium">{o.raisedByRole}</span>: {o.text}
                {o.resolution && (
                  <span className="text-[var(--app-text-muted)]"> — {o.resolution}</span>
                )}
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
          <p className="text-[var(--app-text-muted)]">No audit events recorded yet.</p>
        ) : (
          <ul className="app-caption flex flex-col gap-1 font-mono">
            {pack.auditTrail.slice(0, 5).map((e) => (
              <li key={e.id}>
                {e.at} &middot; {e.event} &middot; hash {e.hash.slice(0, 12)}…
              </li>
            ))}
            {pack.auditTrail.length > 5 && (
              <li className="text-[var(--app-text-muted)]">
                +{pack.auditTrail.length - 5} more — see the full JSON export for the complete
                chain.
              </li>
            )}
          </ul>
        )}
      </Field>

      <p className="app-caption text-[var(--app-text-muted)]">Generated {pack.generatedAt}.</p>
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
      setError(apiErrorMessage(err, 'Could not generate the assurance pack.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="app-panel mt-6 space-y-3 p-5">
      <h3 className="app-h3 text-[var(--app-text)]">Assurance pack</h3>
      <p className="app-small text-[var(--app-text-muted)]">
        A curated summary for governance, risk, and compliance review — named owner, the gate/
        approval map, objections raised, and a hash-chained audit trail, assembled from this
        mission&rsquo;s real records. Two fields this schema has no data source for are reported as
        such, not filled in.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={generate}
          disabled={loading}
        >
          {loading ? 'Generating…' : pack ? 'Regenerate' : 'Generate assurance pack'}
        </Button>
        <a
          className="app-link app-small inline-flex min-h-11 items-center"
          href={apiHref(`/api/forge/missions/${missionId}/assurance-pack`)}
          target="_blank"
          rel="noreferrer"
        >
          Open raw JSON
        </a>
      </div>
      {error && <p className="app-small text-rose-700">{error}</p>}
      {pack && <PackView pack={pack} />}
    </section>
  );
}
