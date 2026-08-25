// @polsia:user-owned — work-items bounded transitions + completion.
import { describe, expect, it } from 'vitest';
import {
  isTerminalWorkItemStatus,
  isValidWorkItemTransition,
  progressSummary,
  type WorkItemRecord,
} from '@/lib/business/forge/work-items';

function item(status: WorkItemRecord['status'], closed = false): WorkItemRecord {
  return {
    id: `wi-${status}-${Math.random()}`,
    status,
    closedAt: closed ? '2026-01-01T00:00:00.000Z' : null,
    supersededById: null,
  };
}

describe('work item transitions', () => {
  it('Open → InProgress is allowed', () => {
    expect(isValidWorkItemTransition('Open', 'InProgress')).toBe(true);
  });
  it('InProgress → InTest is allowed', () => {
    expect(isValidWorkItemTransition('InProgress', 'InTest')).toBe(true);
  });
  it('InTest → Passed is allowed', () => {
    expect(isValidWorkItemTransition('InTest', 'Passed')).toBe(true);
  });
  it('InTest → Rework is allowed', () => {
    expect(isValidWorkItemTransition('InTest', 'Rework')).toBe(true);
  });
  it('Rework → InTest is allowed', () => {
    expect(isValidWorkItemTransition('Rework', 'InTest')).toBe(true);
  });
  it('Open → Passed is NOT allowed (must go through InProgress)', () => {
    expect(isValidWorkItemTransition('Open', 'Passed')).toBe(false);
  });
  it('Passed → anything is NOT allowed (terminal)', () => {
    for (const to of ['Open', 'InProgress', 'InTest', 'Rework', 'Failed', 'Deferred'] as const) {
      expect(isValidWorkItemTransition('Passed', to)).toBe(false);
    }
    expect(isTerminalWorkItemStatus('Passed')).toBe(true);
  });
  it('Failed is terminal and cannot move forward', () => {
    expect(isTerminalWorkItemStatus('Failed')).toBe(false); // rework / deferred still allowed
    expect(isValidWorkItemTransition('Failed', 'Passed')).toBe(false);
    expect(isValidWorkItemTransition('Failed', 'Rework')).toBe(true);
  });
  it('Deferred is reversible to Open / InProgress', () => {
    expect(isValidWorkItemTransition('Deferred', 'Open')).toBe(true);
    expect(isValidWorkItemTransition('Deferred', 'InProgress')).toBe(true);
  });
});

describe('progressSummary', () => {
  it('reports passed count and percentage', () => {
    const summary = progressSummary([
      item('Passed', true),
      item('Passed', true),
      item('InProgress'),
      item('InTest'),
      item('Rework'),
    ]);
    expect(summary.total).toBe(5);
    expect(summary.passed).toBe(2);
    expect(summary.pctPassed).toBeCloseTo(0.4, 5);
    expect(summary.isComplete).toBe(false);
  });
  it('declares mission complete when none are in-flight', () => {
    const summary = progressSummary([item('Passed', true), item('Passed', true)]);
    expect(summary.isComplete).toBe(true);
    expect(summary.pctPassed).toBe(1);
  });
  it('treats Failed as closed but blocks completion', () => {
    const summary = progressSummary([item('Passed', true), item('Failed', true)]);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.isComplete).toBe(false);
  });
  it('handles empty lists without dividing by zero', () => {
    const summary = progressSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.pctPassed).toBe(0);
    // Empty list returns isComplete=false (not auto-complete).
    expect(summary.isComplete).toBe(false);
  });
});
