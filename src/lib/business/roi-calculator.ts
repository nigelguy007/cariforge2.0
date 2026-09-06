// @polsia:user-owned — pure calculation logic for the ROI/feasibility
// calculator (Priority-12 item from the Aug 2026 enterprise-platform
// handoff doc: "Estimate benefit, cost, delivery risk, time saved, and
// scalability"). Deliberately NOT an AI feature and NOT server-side — this
// is real arithmetic on numbers the visitor supplies themselves, so it's
// honest by construction (no model call to degrade, nothing to fabricate).
// Client-importable: no server-only imports, used directly from the form
// component via plain function calls, no API route.

export interface RoiInputs {
  // People currently doing this work, and how many hours per week each
  // spends on the task being considered for a Forge case.
  peopleInvolved: number;
  hoursPerWeekEach: number;
  // Fully-loaded hourly cost of that time (salary + overhead), in whatever
  // currency the visitor is thinking in — the output is unitless multiples
  // of this same currency, never converted or assumed.
  hourlyCost: number;
  // 0-100: how much of that time this kind of workflow could plausibly
  // remove, per the visitor's own estimate — deliberately visitor-supplied
  // rather than a fixed assumption, since CARI Forge has no basis to claim
  // a universal automation percentage.
  estimatedTimeSavedPct: number;
}

export interface RoiOutputs {
  currentWeeklyCost: number;
  currentAnnualCost: number;
  estimatedWeeklyHoursSaved: number;
  estimatedAnnualHoursSaved: number;
  estimatedWeeklyValue: number;
  estimatedAnnualValue: number;
  // The 21-Day Forge itself is inquiry-only with no published price (see
  // pricing/page.tsx — "no payment flow at this stage"), so there is no
  // real cost figure to compute a payback ratio against. An earlier
  // version of this calculator approximated Forge cost as "3 weeks of the
  // team's own salary," which conflated the team's cost with a Forge price
  // that doesn't exist — removed rather than shipped. What's left is
  // exactly what the visitor's own numbers actually support: current
  // spend, and the value of the time this workflow could plausibly free
  // up, at their own estimate.
  indicativeForgeWeeks: number;
  scalabilityNote: string;
}

const FORGE_WEEKS = 3; // the 21-Day Forge is literally three weeks — not an estimate

export function calculateRoi(inputs: RoiInputs): RoiOutputs {
  const people = Math.max(0, inputs.peopleInvolved);
  const hours = Math.max(0, inputs.hoursPerWeekEach);
  const cost = Math.max(0, inputs.hourlyCost);
  const savedPct = Math.min(100, Math.max(0, inputs.estimatedTimeSavedPct)) / 100;

  const currentWeeklyCost = people * hours * cost;
  const currentAnnualCost = currentWeeklyCost * 52;
  const estimatedWeeklyHoursSaved = people * hours * savedPct;
  const estimatedAnnualHoursSaved = estimatedWeeklyHoursSaved * 52;
  const estimatedWeeklyValue = estimatedWeeklyHoursSaved * cost;
  const estimatedAnnualValue = estimatedAnnualHoursSaved * cost;

  return {
    currentWeeklyCost,
    currentAnnualCost,
    estimatedWeeklyHoursSaved,
    estimatedAnnualHoursSaved,
    estimatedWeeklyValue,
    estimatedAnnualValue,
    indicativeForgeWeeks: FORGE_WEEKS,
    scalabilityNote:
      people >= 5
        ? 'At this many people already doing the work by hand, a validated workflow tends to scale cleanly to more of the same team — the Partner agent hands off the build so your own people can extend it.'
        : 'A small team today is still a legitimate 21-Day Forge case — the value case above is what it is regardless of headcount; scale isn’t a prerequisite for a bounded proof.',
  };
}
