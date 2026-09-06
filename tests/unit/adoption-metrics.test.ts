import { describe, expect, it } from 'vitest';

import {
  computeAdoptionMetrics,
  computeQualityMetrics,
} from '@/lib/business/forge/adoption-metrics';

describe('adoption-metrics — real aggregates, no fabricated sample data', () => {
  it('reports zero missions honestly rather than a fabricated placeholder', () => {
    const out = computeAdoptionMetrics([]);
    expect(out.totalMissions).toBe(0);
    expect(out.statusBreakdown).toEqual([]);
    expect(out.completionRate).toBeNull();
    expect(out.averageCycleTimeDays).toBeNull();
  });

  it('counts every mission exactly once across statuses', () => {
    const out = computeAdoptionMetrics([
      {
        status: 'Completed',
        createdAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-05T00:00:00Z',
      },
      {
        status: 'Completed',
        createdAt: '2026-01-02T00:00:00Z',
        completedAt: '2026-01-08T00:00:00Z',
      },
      { status: 'InDiscovery', createdAt: '2026-01-03T00:00:00Z', completedAt: null },
      { status: 'WalkedAway', createdAt: '2026-01-04T00:00:00Z', completedAt: null },
    ]);
    expect(out.totalMissions).toBe(4);
    const completed = out.statusBreakdown.find((s) => s.status === 'Completed');
    expect(completed?.count).toBe(2);
  });

  it('computes completion rate only over terminal missions, not in-flight ones', () => {
    const out = computeAdoptionMetrics([
      {
        status: 'Completed',
        createdAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-05T00:00:00Z',
      },
      { status: 'WalkedAway', createdAt: '2026-01-01T00:00:00Z', completedAt: null },
      { status: 'InDiscovery', createdAt: '2026-01-01T00:00:00Z', completedAt: null }, // not terminal
      { status: 'InWorkflow', createdAt: '2026-01-01T00:00:00Z', completedAt: null }, // not terminal
    ]);
    // 1 Completed out of 2 terminal (Completed + WalkedAway) — the two
    // in-flight missions must not dilute the denominator.
    expect(out.terminalMissionCount).toBe(2);
    expect(out.completionRate).toBe(0.5);
  });

  it('computes average cycle time only over Completed missions with both dates', () => {
    const out = computeAdoptionMetrics([
      {
        status: 'Completed',
        createdAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-04T00:00:00Z',
      }, // 3 days
      {
        status: 'Completed',
        createdAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-06T00:00:00Z',
      }, // 5 days
      { status: 'RolledBack', createdAt: '2026-01-01T00:00:00Z', completedAt: null }, // excluded
    ]);
    expect(out.averageCycleTimeDays).toBe(4);
  });

  it('buckets missions by ISO week (Monday start, UTC)', () => {
    const out = computeAdoptionMetrics([
      // Both a Wednesday and the following Monday — same calendar week bucket
      // as their respective Mondays, not merged together.
      { status: 'Draft', createdAt: '2026-01-07T00:00:00Z', completedAt: null }, // Wed
      { status: 'Draft', createdAt: '2026-01-08T00:00:00Z', completedAt: null }, // Thu, same week
      { status: 'Draft', createdAt: '2026-01-12T00:00:00Z', completedAt: null }, // next Monday
    ]);
    expect(out.missionsByWeek).toHaveLength(2);
    const totalAcrossWeeks = out.missionsByWeek.reduce((sum, w) => sum + w.count, 0);
    expect(totalAcrossWeeks).toBe(3);
  });

  it('never produces a negative cycle time even if completedAt somehow precedes createdAt', () => {
    const out = computeAdoptionMetrics([
      {
        status: 'Completed',
        createdAt: '2026-01-10T00:00:00Z',
        completedAt: '2026-01-01T00:00:00Z',
      },
    ]);
    expect(out.averageCycleTimeDays).toBeGreaterThanOrEqual(0);
  });
});

describe('quality metrics — objection resolution, no fabricated rate', () => {
  it('reports null resolution rate when there are no objections, not 0%', () => {
    const out = computeQualityMetrics([]);
    expect(out.totalObjections).toBe(0);
    expect(out.resolutionRate).toBeNull();
  });

  it('splits resolved vs unresolved by a non-null resolution field', () => {
    const out = computeQualityMetrics([
      { resolution: 'Overruled' },
      { resolution: 'OwnerResolved' },
      { resolution: null },
    ]);
    expect(out.resolvedCount).toBe(2);
    expect(out.unresolvedCount).toBe(1);
    expect(out.resolutionRate).toBeCloseTo(2 / 3);
  });
});
