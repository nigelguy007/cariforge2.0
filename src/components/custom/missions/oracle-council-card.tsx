// @polsia:user-owned — TAG pilot Oracle council card. Renders the five gates
// of The Oracles + the assigned Elder Oracle identity (or a CTA when none is
// appointed yet). Pulls the existing mission-detail shape; the Elder
// assignment + handoff attesters live alongside it.

'use client';

import { ShieldCheck, UserCog, type Users } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { ORACLE_ROLE_NAMES } from '@/lib/business/forge/oracle-council';
import {
  type ApprovalItemT,
  type GateStateT,
  type HandoffItemT,
  isApproveDecision,
  type MissionDetailT,
  type MissionOracleAssignmentItemT,
  type OracleRole,
} from '@/lib/contracts/forge';

interface OracleCouncilCardProps {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}

export function OracleCouncilCard({ detail, onWritten }: OracleCouncilCardProps) {
  const elder = detail.oracleRoster.find((r) => r.role === 'ElderOracle') ?? null;
  const elderUserId = detail.mission.elderOracleUserId;
  const [assigning, setAssigning] = React.useState(false);
  const [userIdInput, setUserIdInput] = React.useState('');

  // Gate ladder rows — five gates, one per Oracle, in lifecycle order.
  const rows = detail.gates.map((g) => {
    const approvalForGate = detail.approvals.find(
      (a) => a.gateIndex === g.gateIndex && isApproveDecision(a.decision),
    );
    const handoff = detail.handoffs.find((h) => h.id === g.currentStageHandoffId);
    const attestersOnHandoff = handoff
      ? detail.handoffAttesters.filter((a) => a.handoffId === handoff.id)
      : [];
    const oracleRole = oracleRoleForGate(g.gateIndex);
    return { gate: g, approval: approvalForGate, handoff, attestersOnHandoff, oracleRole };
  });

  const onAssign = React.useCallback(async () => {
    if (!userIdInput.trim()) {
      toast.error('Enter the Elder Oracle user id first.');
      return;
    }
    setAssigning(true);
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/elder-oracle`, {
        method: 'POST',
        body: JSON.stringify({ userId: userIdInput.trim() }),
      });
      toast.success('Elder Oracle appointed.');
      setUserIdInput('');
      await onWritten();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not appoint Elder Oracle.'));
    } finally {
      setAssigning(false);
    }
  }, [detail.mission.id, userIdInput, onWritten]);

  return (
    <section className="glass-card space-y-4 rounded-2xl p-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="size-5 text-brand-600" aria-hidden />
        <div>
          <p className="text-eyebrow text-brand-700">The Oracles — TAG Caribbean governance</p>
          <h2 className="text-h3 text-foreground">Five named gates, one Elder Oracle.</h2>
        </div>
      </header>

      <p className="text-body text-muted-foreground">
        Each gate is signed by a named human at the matching gate of The Oracles. Gates{' '}
        <strong>0 (Need Discovery)</strong> and <strong>4 (Software Build)</strong> require the same
        named Elder Oracle to attest — no specialist or model can skip that signature. Every gate
        also requires at least one specialist attester on the handoff being decided.
      </p>

      <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.gate.gateIndex} className="glass-panel rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-brand-700">
              Gate {r.gate.gateIndex} — {ORACLE_ROLE_NAMES[r.oracleRole].name}
            </p>
            <p className="text-h4">Gate {r.gate.stage}</p>
            <p className="mt-1 text-small text-muted-foreground">
              State: <span className="text-foreground">{r.gate.state}</span>
            </p>
            {r.approval ? (
              <p className="mt-2 text-small">
                Approver:{' '}
                <code className="text-caption">{r.approval.approverUserId ?? 'system'}</code>
                {r.approval.approverMatchedElder ? (
                  <span className="ml-2 glass-chip rounded-full bg-brand-50 px-2 py-0.5 text-caption text-brand-700">
                    Elder
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-small text-muted-foreground">Awaiting approval.</p>
            )}
            <p className="mt-1 text-small text-muted-foreground">
              Attesters on this handoff:{' '}
              {r.attestersOnHandoff.length === 0 ? 'none yet' : r.attestersOnHandoff.length}
            </p>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 rounded-xl border border-brand-200/60 p-4 md:grid-cols-2">
        <div>
          <p className="text-eyebrow text-brand-700">Assigned Elder Oracle</p>
          {elder ? (
            <p className="mt-1 text-body">
              <code className="text-caption">{elder.userId}</code>{' '}
              <span className="text-small text-muted-foreground">
                appointed by {elder.appointedById} on{' '}
                {new Date(elder.appointedAt).toLocaleDateString()}
              </span>
            </p>
          ) : elderUserId ? (
            <p className="mt-1 text-body">
              <code className="text-caption">{elderUserId}</code>{' '}
              <span className="text-small text-muted-foreground">(sync from roster)</span>
            </p>
          ) : (
            <p className="mt-1 text-small text-muted-foreground">
              No Elder Oracle has been appointed yet. Gates 0 and 4 will throw
              <code className="ml-1 text-caption">FORGE_GATE_LOCKED</code> on the first attempt.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="elder-user-id">Appoint a new Elder Oracle (admin only)</Label>
          <div className="flex gap-2">
            <Input
              id="elder-user-id"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="user id (e.g. auth user id)"
            />
            <Button type="button" variant="secondary" onClick={onAssign} disabled={assigning}>
              <UserCog className="mr-1 size-4" aria-hidden />
              {assigning ? 'Appointing…' : 'Appoint'}
            </Button>
          </div>
          <p className="text-small text-muted-foreground">
            Send a POST with this userId to{' '}
            <code className="text-caption">/api/forge/missions/{'{id}'}/elder-oracle</code>.
          </p>
        </div>
      </div>
    </section>
  );
}

// Reuse the symbols from OracleCouncil: dual-export so tests can call this
// component without dragging the business module into the client bundle.
function oracleRoleForGate(gateIndex: number): OracleRole {
  switch (gateIndex) {
    case 0:
      return 'NeedOracle';
    case 1:
      return 'ReadinessOracle';
    case 2:
      return 'WorkflowOracle';
    case 3:
      return 'GovernanceOracle';
    case 4:
      return 'BuildOracle';
    default:
      return 'ElderOracle';
  }
}

// Also re-export a second symbol so the barrel stays consistent.
export { OracleCouncilCard as OracleCouncilCardComponent };

export interface OracleCouncilArtifacts {
  elder: MissionOracleAssignmentItemT | null;
  roster: readonly MissionOracleAssignmentItemT[];
  attestersByHandoff: ReadonlyMap<string, readonly MissionOracleAssignmentItemT[]>;
  approvalByGate: ReadonlyMap<number, ApprovalItemT>;
  handoffByGate: ReadonlyMap<number, HandoffItemT>;
  gateByIndex: ReadonlyMap<number, GateStateT>;
  icon: typeof Users;
}
