// @polsia:user-owned — tool-action policy coverage. Pure logic only.
import { describe, expect, it } from 'vitest';
import {
  assertExternalApproved,
  assertRollbackLink,
  assertScopeDenied,
  FORGE_ERROR_CODES,
  ForgeError,
} from '@/lib/business/forge/tool-actions';
import type { MissionStatus, ToolActionScope } from '@/lib/contracts/forge';

function toolAction(
  overrides: Partial<{
    id: string;
    scope: ToolActionScope;
    requiresGateApproval: boolean;
    approvedGateIndex: number | null;
    decision: 'Approved' | 'Denied' | null;
    executedAt: Date | null;
  }> = {},
) {
  return {
    id: 'ta-1',
    scope: 'Internal' as ToolActionScope,
    requiresGateApproval: false,
    approvedGateIndex: null,
    decision: null as 'Approved' | 'Denied' | null,
    executedAt: null as Date | null,
    ...overrides,
  };
}

describe('tool action scope policy', () => {
  it.each(['Paused', 'Blocked', 'Rejected', 'WalkedAway', 'RolledBack'] as MissionStatus[])(
    'denies tool actions while mission is %s',
    (status) => {
      expect(() => assertScopeDenied('Internal', status)).toThrow(ForgeError);
      expect(() => assertScopeDenied('External', status)).toThrow(ForgeError);
    },
  );
  it.each([
    'Draft',
    'InDiscovery',
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
    'AwaitingApproval',
  ] as MissionStatus[])('allows tool actions while mission is %s', (status) => {
    expect(() => assertScopeDenied('Internal', status)).not.toThrow();
  });
});

describe('tool action external approval gate', () => {
  it('External scope requires gate approval', () => {
    expect(() =>
      assertExternalApproved(toolAction({ scope: 'External', requiresGateApproval: true }), []),
    ).toThrow(ForgeError);
    try {
      assertExternalApproved(toolAction({ scope: 'External', requiresGateApproval: true }), []);
    } catch (err) {
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.TOOL_GATE_APPROVAL_MISSING);
    }
  });
  it('External with gate approval is allowed', () => {
    expect(() =>
      assertExternalApproved(toolAction({ scope: 'External', requiresGateApproval: true }), [
        { gateIndex: 2, decision: 'Approve' },
      ]),
    ).not.toThrow();
  });
  it('External without requiresGateApproval=true is denied', () => {
    expect(() =>
      assertExternalApproved(toolAction({ scope: 'External', requiresGateApproval: false }), [
        { gateIndex: 2, decision: 'Approve' },
      ]),
    ).toThrow(ForgeError);
    try {
      assertExternalApproved(toolAction({ scope: 'External', requiresGateApproval: false }), [
        { gateIndex: 2, decision: 'Approve' },
      ]);
    } catch (err) {
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.TOOL_SCOPE_DENIED);
    }
  });
  it('Internal without gate approval is still allowed', () => {
    expect(() => assertExternalApproved(toolAction({ scope: 'Internal' }), [])).not.toThrow();
  });
});

describe('tool rollback target', () => {
  it('requires the prior action to have executed', () => {
    expect(() =>
      assertRollbackLink(toolAction({ id: 'ta-2' }), toolAction({ id: 'ta-1' })),
    ).toThrow(ForgeError);
  });
  it('allows rollback to a previously executed action', () => {
    expect(() =>
      assertRollbackLink(
        toolAction({ id: 'ta-2' }),
        toolAction({ id: 'ta-1', executedAt: new Date() }),
      ),
    ).not.toThrow();
  });
  it('forbids self-rollback', () => {
    const same = toolAction({ id: 'ta-1', executedAt: new Date() });
    expect(() => assertRollbackLink(same, same)).toThrow(ForgeError);
  });
});
