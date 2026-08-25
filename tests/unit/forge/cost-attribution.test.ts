// @polsia:user-owned — cost attribution coverage. Unknown model returns an
// HONEST { cents: 0, unknownCost: true } shape; blended carry propagates the
// unknown flag through the rollup.
import { describe, expect, it } from 'vitest';
import {
  blendedCostCents,
  COST_TABLE,
  chatCostCents,
  creditLedgerTotals,
  modelUsageCostCents,
} from '@/lib/business/forge/cost-attribution';

describe('modelUsageCostCents', () => {
  it('returns an integer cost for a known anthropic model', () => {
    const r = modelUsageCostCents('claude-sonnet-4-6', 1_000_000, 500_000);
    expect(r.unknownCost).toBe(false);
    // 1M in @ 300 cents + 0.5M out @ 1500 cents
    expect(r.cents).toBe(300 + 750);
  });

  it('case-insensitive lookup works', () => {
    const r = modelUsageCostCents('CLAUDE-Sonnet-4-6', 2_000_000, 0);
    expect(r.unknownCost).toBe(false);
    expect(r.cents).toBe(2 * 300);
  });

  it('unknown model returns { cents: 0, unknownCost: true } (HONEST)', () => {
    const r = modelUsageCostCents('gpt-99-future', 1_000_000, 1_000_000);
    expect(r.cents).toBe(0);
    expect(r.unknownCost).toBe(true);
  });

  it('zero / negative token counts are safe', () => {
    const r = modelUsageCostCents('claude-haiku-4-5-20251001', 0, 0);
    expect(r.cents).toBe(0);
    expect(r.unknownCost).toBe(false);
    const negative = modelUsageCostCents('claude-haiku-4-5-20251001', -1, -1);
    expect(negative.cents).toBe(0);
  });

  it('COST_TABLE has no unknown keys (sanity: surface == truth)', () => {
    expect(COST_TABLE.__nope__).toBeUndefined();
  });
});

describe('chatCostCents', () => {
  it('counts chat messages at the per-message rate', () => {
    const r = chatCostCents('claude-sonnet-4-6', 50);
    expect(r.unknownCost).toBe(false);
    expect(r.cents).toBe(50 * 2);
  });

  it('unknown model returns HONEST 0/unknown', () => {
    const r = chatCostCents('unknown-future-chat-model', 10);
    expect(r.cents).toBe(0);
    expect(r.unknownCost).toBe(true);
  });

  it('zero messages are not unknown', () => {
    const r = chatCostCents('claude-sonnet-4-6', 0);
    expect(r.cents).toBe(0);
    expect(r.unknownCost).toBe(false);
  });
});

describe('blendedCostCents', () => {
  it('sums known model + chat totals', () => {
    const r = blendedCostCents({
      missionId: 'm-1',
      modelRows: [
        { model: 'claude-opus-4-7', promptTokens: 1_000_000, completionTokens: 1_000_000 },
      ],
      chatRows: [{ model: 'claude-haiku-4-5-20251001', messageCount: 100 }],
    });
    expect(r.modelCents).toBe(1500 + 7500);
    expect(r.chatCents).toBe(100);
    expect(r.blendedCents).toBe(9100);
    expect(r.hasUnknownCost).toBe(false);
  });

  it('one unknown model row propagates hasUnknownCost', () => {
    const r = blendedCostCents({
      missionId: 'm-2',
      modelRows: [
        { model: 'claude-haiku-4-5-20251001', promptTokens: 1_000_000, completionTokens: 0 },
        { model: 'gpt-99-future', promptTokens: 0, completionTokens: 0 },
      ],
      chatRows: [{ model: 'gpt-4o-mini', messageCount: 10 }],
    });
    expect(r.modelCents).toBe(80); // haiku alone, future is unknown -> 0
    expect(r.hasUnknownCost).toBe(true);
  });

  it('empty rollup is well-defined', () => {
    const r = blendedCostCents({ missionId: 'm-3', modelRows: [], chatRows: [] });
    expect(r.modelCents).toBe(0);
    expect(r.chatCents).toBe(0);
    expect(r.blendedCents).toBe(0);
    expect(r.hasUnknownCost).toBe(false);
  });
});

describe('creditLedgerTotals', () => {
  it('splits positive (credits) and negative (debits) sums', () => {
    const r = creditLedgerTotals([
      { amountCents: 5000 },
      { amountCents: -1500 },
      { amountCents: 1000 },
      { amountCents: -200 },
    ]);
    expect(r.credits).toBe(6000);
    expect(r.debits).toBe(1700);
    expect(r.net).toBe(4300);
  });

  it('empty ledger is zero', () => {
    expect(creditLedgerTotals([])).toEqual({ credits: 0, debits: 0, net: 0 });
  });
});
