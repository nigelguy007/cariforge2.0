// @polsia:user-owned — the ROI/feasibility calculator (Priority-12 item
// from the Aug 2026 enterprise-platform handoff doc). Pure client-side
// arithmetic on numbers the visitor supplies (src/lib/business/roi-
// calculator.ts) — no API call, no AI, nothing to degrade or fabricate.
// Every number in the output is either a direct function of the visitor's
// own inputs or a fixed, real fact (the 21-Day Forge is genuinely three
// weeks) — never an invented industry benchmark.

'use client';

import { useMemo, useState } from 'react';
import { GlassChip } from '@/components/custom/glass';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { calculateRoi, type RoiInputs } from '@/lib/business/roi-calculator';

const DEFAULTS: RoiInputs = {
  peopleInvolved: 3,
  hoursPerWeekEach: 8,
  hourlyCost: 45,
  estimatedTimeSavedPct: 50,
};

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </div>
  );
}

export function RoiCalculator() {
  const [inputs, setInputs] = useState<RoiInputs>(DEFAULTS);
  const output = useMemo(() => calculateRoi(inputs), [inputs]);

  const set =
    <K extends keyof RoiInputs>(key: K) =>
    (value: number) =>
      setInputs((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : 0 }));

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <NumberField
          id="roi-people"
          label="People currently doing this work"
          value={inputs.peopleInvolved}
          onChange={set('peopleInvolved')}
          min={0}
        />
        <NumberField
          id="roi-hours"
          label="Hours per week, each"
          value={inputs.hoursPerWeekEach}
          onChange={set('hoursPerWeekEach')}
          min={0}
          step={0.5}
        />
        <NumberField
          id="roi-cost"
          label="Fully-loaded hourly cost (your currency)"
          value={inputs.hourlyCost}
          onChange={set('hourlyCost')}
          min={0}
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="roi-saved">Time this kind of workflow could plausibly remove</Label>
            <span className="text-small font-semibold text-foreground">
              {inputs.estimatedTimeSavedPct}%
            </span>
          </div>
          <Slider
            id="roi-saved"
            min={0}
            max={100}
            step={5}
            value={[inputs.estimatedTimeSavedPct]}
            onValueChange={([v]) => set('estimatedTimeSavedPct')(v ?? 0)}
          />
          <p className="text-caption text-muted-foreground">
            Your own estimate — CARI Forge has no basis to claim a universal automation percentage,
            and the Readiness agent audits the real number before any code is written.
          </p>
        </div>
      </div>

      <div className="glass-card flex flex-col gap-4 rounded-2xl p-6 text-card-foreground">
        <GlassChip tone="brand" className="self-start">
          Indicative value case
        </GlassChip>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-caption text-muted-foreground">Current annual cost of this work</p>
            <p className="font-display text-h4 tracking-tight text-foreground">
              {formatCurrency(output.currentAnnualCost)}
            </p>
          </div>
          <div>
            <p className="text-caption text-muted-foreground">Estimated hours saved / year</p>
            <p className="font-display text-h4 tracking-tight text-foreground">
              {formatCurrency(output.estimatedAnnualHoursSaved)}
            </p>
          </div>
          <div>
            <p className="text-caption text-muted-foreground">Estimated annual value</p>
            <p className="font-display text-h4 tracking-tight text-foreground">
              {formatCurrency(output.estimatedAnnualValue)}
            </p>
          </div>
          <div>
            <p className="text-caption text-muted-foreground">21-Day Forge, for scale</p>
            <p className="font-display text-h4 tracking-tight text-foreground">
              {output.indicativeForgeWeeks} weeks
            </p>
          </div>
        </div>
        <p className="border-t border-border pt-3 text-small text-card-foreground/85">
          That&rsquo;s roughly{' '}
          <span className="font-semibold text-foreground">
            {formatCurrency(output.estimatedWeeklyValue)}
          </span>{' '}
          of value per week once a workflow like this is live &mdash; not a production ROI figure
          (Production Forge, the deployment stage, is scoped per engagement, not estimated here),
          just what your own numbers say about the time currently going into this by hand.
        </p>
        <p className="text-caption text-muted-foreground">{output.scalabilityNote}</p>
      </div>
    </div>
  );
}
