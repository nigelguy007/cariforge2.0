// @polsia:user-owned — gate reason-code + attribution coverage.
import { describe, expect, it } from 'vitest';
import {
  assertAttribution,
  assertNonApproveAttribution,
  assertReasonAllowed,
  FORGE_ERROR_CODES,
  ForgeError,
} from '@/lib/business/forge/policy';
import { GATE_DEFS } from '@/lib/contracts/forge';

describe('forge gate reason codes', () => {
  it('every gate definition has at least 2 allowed reason codes', () => {
    for (const gate of GATE_DEFS) {
      expect(gate.allowedReasonCodes.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('every gate allows Approved', () => {
    for (const gate of GATE_DEFS) {
      expect(gate.allowedReasonCodes).toContain('Approved');
    }
  });
  it('accepts a realistic Approve + Approved reason code', () => {
    expect(() => assertReasonAllowed(0, 'Approved')).not.toThrow();
    expect(() => assertReasonAllowed(4, 'Approved')).not.toThrow();
  });
  it('rejects reason code outside gate set', () => {
    expect(() => assertReasonAllowed(0, 'GovernanceViolation')).toThrow(ForgeError);
    try {
      assertReasonAllowed(0, 'GovernanceViolation');
    } catch (err) {
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.REASON_NOT_PERMITTED);
    }
  });
  it('throws on unknown gate index', () => {
    expect(() => assertReasonAllowed(99, 'Approved')).toThrow(ForgeError);
  });
});

describe('forge attribution shape', () => {
  it('Approve requires text + code + approver', () => {
    expect(() =>
      assertAttribution({
        decision: 'Approve',
        reasonCode: 'Approved',
        reasonText: '',
        approverUserId: 'user-1',
      }),
    ).toThrow(ForgeError);
    expect(() =>
      assertAttribution({
        decision: 'Approve',
        reasonCode: 'Approved',
        reasonText: 'looks good',
        approverUserId: '',
      }),
    ).toThrow(ForgeError);
    expect(() =>
      assertAttribution({
        decision: 'Approve',
        reasonCode: 'Approved',
        reasonText: 'looks good',
        approverUserId: 'user-1',
      }),
    ).not.toThrow();
  });
  it('Return / Refuse require text + code', () => {
    expect(() =>
      assertNonApproveAttribution({
        decision: 'Return',
        reasonCode: 'EvidenceRequested',
        reasonText: '',
        approverUserId: 'user-1',
      }),
    ).toThrow(ForgeError);
  });
  it('attribution error code is consistent', () => {
    try {
      assertAttribution({
        decision: 'Approve',
        reasonCode: 'Approved',
        reasonText: '',
        approverUserId: undefined,
      });
    } catch (err) {
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.ATTRIBUTION_MISSING);
    }
  });
});
