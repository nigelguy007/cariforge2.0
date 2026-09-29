// @polsia:user-owned — the global kill switch for the fundraise loop. A
// status banner that always says plainly whether anything can be sent, plus a
// Switch that toggles `sendingEnabled` via PATCH /api/admin/fundraise/config.
// Turning sending ON asks for confirmation first; turning it OFF is immediate
// (the safe direction never needs a second click).

'use client';

import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { ConfigUpdate } from '@/lib/contracts/fundraise-loop';
import { cn } from '@/lib/utils';
import { errorMessage, OkResponse, sendJson } from './fundraise-shared';

export function SendingControl({
  sendingEnabled,
  onChanged,
}: {
  sendingEnabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const save = React.useCallback(
    async (next: boolean) => {
      setSaving(true);
      try {
        const body: ConfigUpdate = { sendingEnabled: next };
        await sendJson('/api/admin/fundraise/config', 'PATCH', body, OkResponse);
        toast.success(next ? 'Sending turned on' : 'Sending turned off');
        setConfirmOpen(false);
        await onChanged();
      } catch (err) {
        toast.error(errorMessage(err, 'Could not change the sending switch.'));
      } finally {
        setSaving(false);
      }
    },
    [onChanged],
  );

  const onCheckedChange = (checked: boolean) => {
    if (checked) setConfirmOpen(true);
    else void save(false);
  };

  const Icon = sendingEnabled ? ShieldAlert : ShieldCheck;

  return (
    <>
      <div
        role="status"
        className={cn(
          'flex flex-col gap-3 rounded-[var(--app-radius)] border p-4 sm:flex-row sm:items-center sm:justify-between',
          sendingEnabled
            ? 'border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100'
            : 'border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]',
        )}
      >
        <div className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="app-body font-semibold">
              {sendingEnabled ? 'Sending is ON' : 'Sending is OFF'}
            </p>
            <p className="app-small opacity-80">
              {sendingEnabled
                ? 'Approved batches will be sent to HeyReach on the next scheduled run.'
                : 'Batches can be approved but nothing is sent.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          <label htmlFor="fundraise-sending" className="app-small font-medium">
            Allow sending
          </label>
          <Switch
            id="fundraise-sending"
            checked={sendingEnabled}
            disabled={saving}
            onCheckedChange={onCheckedChange}
          />
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Turn sending on?</DialogTitle>
            <DialogDescription>
              Every batch you have approved — and any you approve from now on — will be sent to
              investors on the next scheduled run. Real people will receive these messages. You can
              turn sending off again at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
            >
              Keep it off
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save(true)}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Turn sending on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
