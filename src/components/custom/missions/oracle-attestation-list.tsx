// @polsia:user-owned — Specialist attester panel. Lists the typed specialist
// attesters on a single handoff and offers any authed user the option to add
// themselves as one. Drives the ATTESTER precondition of decideGate.

'use client';

import { UserPlus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import {
  type HandoffItemT,
  type MissionDetailT,
  SPECIALIST_ROLE_VALUES,
  type SpecialistRole,
  type StageHandoffAttesterItemT,
} from '@/lib/contracts/forge';

interface OracleAttestationListProps {
  detail: MissionDetailT;
  handoff: HandoffItemT;
  onWritten: () => Promise<void> | void;
}

export function OracleAttestationList({ detail, handoff, onWritten }: OracleAttestationListProps) {
  const attesters = detail.handoffAttesters.filter((a) => a.handoffId === handoff.id) ?? [];
  const [adding, setAdding] = React.useState(false);
  const [userIdInput, setUserIdInput] = React.useState('');
  const [role, setRole] = React.useState<SpecialistRole>('Risk');

  const onAdd = React.useCallback(async () => {
    if (!userIdInput.trim()) {
      toast.error('Enter the specialist user id first.');
      return;
    }
    setAdding(true);
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/handoffs/${handoff.id}/attesters`, {
        method: 'POST',
        body: JSON.stringify({ userId: userIdInput.trim(), role }),
      });
      toast.success('Specialist attester recorded.');
      setUserIdInput('');
      await onWritten();
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not record attester.');
    } finally {
      setAdding(false);
    }
  }, [detail.mission.id, handoff.id, userIdInput, role, onWritten]);

  return (
    <section className="space-y-3 rounded-xl border border-border/60 p-4">
      <header>
        <p className="text-eyebrow text-brand-700">Specialist attesters on this handoff</p>
        <p className="text-small text-muted-foreground">
          The named human approver for this gate decides, but at least one specialist attester (Risk
          / Demand / Growth / Competition / Money) must sign the handoff before the gate can be
          decided.
        </p>
      </header>
      {attesters.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No specialist attesters on this handoff yet. The gate cannot be decided until one signs.
        </p>
      ) : (
        <ul className="space-y-2 text-body">
          {attesters.map((a: StageHandoffAttesterItemT) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-small"
            >
              <span className="glass-chip rounded-full bg-brand-50 px-2 py-0.5 text-caption text-brand-700">
                {a.role}
              </span>
              <code className="text-caption">{a.userId}</code>
              <span className="ml-auto text-caption text-muted-foreground">
                signed {new Date(a.signedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 md:grid-cols-3">
        <div className="md:col-span-1">
          <Label htmlFor="attester-user-id">Specialist user id</Label>
          <Input
            id="attester-user-id"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="user id"
          />
        </div>
        <div>
          <Label htmlFor="attester-role">Specialist voice</Label>
          <Select value={role} onValueChange={(v) => setRole(v as SpecialistRole)}>
            <SelectTrigger id="attester-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPECIALIST_ROLE_VALUES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onAdd}
            disabled={adding}
            className="w-full"
          >
            <UserPlus className="mr-1 size-4" aria-hidden />
            {adding ? 'Recording…' : 'Record attester'}
          </Button>
        </div>
      </div>
    </section>
  );
}
