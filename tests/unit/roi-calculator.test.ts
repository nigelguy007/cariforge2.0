import { describe, expect, it } from 'vitest';

import { calculateRoi } from '@/lib/business/roi-calculator';

describe('roi-calculator — pure arithmetic, no fabricated benchmarks', () => {
  it('computes current weekly/annual cost as a direct product of the inputs', () => {
    const out = calculateRoi({
      peopleInvolved: 3,
      hoursPerWeekEach: 8,
      hourlyCost: 45,
      estimatedTimeSavedPct: 50,
    });
    expect(out.currentWeeklyCost).toBe(3 * 8 * 45);
    expect(out.currentAnnualCost).toBe(3 * 8 * 45 * 52);
  });

  it('scales estimated hours/value saved by the visitor-supplied percentage, not a fixed assumption', () => {
    const out = calculateRoi({
      peopleInvolved: 2,
      hoursPerWeekEach: 10,
      hourlyCost: 50,
      estimatedTimeSavedPct: 25,
    });
    expect(out.estimatedWeeklyHoursSaved).toBe(2 * 10 * 0.25);
    expect(out.estimatedAnnualHoursSaved).toBe(2 * 10 * 0.25 * 52);
    expect(out.estimatedWeeklyValue).toBe(2 * 10 * 0.25 * 50);
  });

  it('clamps the saved percentage to 0-100 rather than producing a nonsense multiplier', () => {
    const over = calculateRoi({
      peopleInvolved: 1,
      hoursPerWeekEach: 10,
      hourlyCost: 10,
      estimatedTimeSavedPct: 250,
    });
    const under = calculateRoi({
      peopleInvolved: 1,
      hoursPerWeekEach: 10,
      hourlyCost: 10,
      estimatedTimeSavedPct: -50,
    });
    expect(over.estimatedWeeklyHoursSaved).toBe(10); // capped at 100%
    expect(under.estimatedWeeklyHoursSaved).toBe(0); // floored at 0%
  });

  it('clamps negative people/hours/cost to zero rather than producing a negative cost', () => {
    const out = calculateRoi({
      peopleInvolved: -5,
      hoursPerWeekEach: -10,
      hourlyCost: -100,
      estimatedTimeSavedPct: 50,
    });
    expect(out.currentWeeklyCost).toBe(0);
    expect(out.estimatedWeeklyValue).toBe(0);
  });

  it('states the 21-Day Forge duration as the fixed, real fact it is, not a computed estimate', () => {
    const out = calculateRoi({
      peopleInvolved: 1,
      hoursPerWeekEach: 1,
      hourlyCost: 1,
      estimatedTimeSavedPct: 1,
    });
    expect(out.indicativeForgeWeeks).toBe(3);
  });

  it('does not expose a payback/ROI ratio against a Forge price, since none is published', () => {
    const out = calculateRoi({
      peopleInvolved: 3,
      hoursPerWeekEach: 8,
      hourlyCost: 45,
      estimatedTimeSavedPct: 50,
    });
    expect(out).not.toHaveProperty('paybackWeeksAgainstForgeAlone');
    expect(out).not.toHaveProperty('roi');
    expect(out).not.toHaveProperty('paybackWeeks');
  });

  it('gives a different scalability note above and below the five-person threshold', () => {
    const small = calculateRoi({
      peopleInvolved: 2,
      hoursPerWeekEach: 8,
      hourlyCost: 45,
      estimatedTimeSavedPct: 50,
    });
    const large = calculateRoi({
      peopleInvolved: 5,
      hoursPerWeekEach: 8,
      hourlyCost: 45,
      estimatedTimeSavedPct: 50,
    });
    expect(small.scalabilityNote).not.toBe(large.scalabilityNote);
  });
});
