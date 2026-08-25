// @polsia:user-owned — TAG Oracle Council governance coverage. Pure:
// asserts the five names, the Elder requirements (gates 0 + 4), and the
// specialist-attester precondition. Called from decideGate so any drift
// surfaces here before a gate decision lands.

import { describe, expect, it } from 'vitest';
import {
  assertElderOracleAttested,
  assertSpecialistAttestersPresent,
  ELDER_ORACLE_GATE_INDEXES,
  FORGE_ERROR_CODES,
  ForgeError,
  isElderGate,
  ORACLE_ROLE_NAMES,
  oracleRoleForGateIndex,
} from '@/lib/business/forge/oracle-council';

describe('TAG Oracle Council — role names', () => {
  it('names the five per-gate Oracles + Elder', () => {
    expect(ORACLE_ROLE_NAMES.NeedOracle.name).toBe('Need Oracle');
    expect(ORACLE_ROLE_NAMES.ReadinessOracle.name).toBe('Readiness Oracle');
    expect(ORACLE_ROLE_NAMES.WorkflowOracle.name).toBe('Workflow Oracle');
    expect(ORACLE_ROLE_NAMES.GovernanceOracle.name).toBe('Governance Oracle');
    expect(ORACLE_ROLE_NAMES.BuildOracle.name).toBe('Build Oracle');
    expect(ORACLE_ROLE_NAMES.ElderOracle.name).toBe('Elder Oracle');
  });

  it('binds each per-gate Oracle role to its stage', () => {
    expect(ORACLE_ROLE_NAMES.NeedOracle.stage).toBe('Discovery');
    expect(ORACLE_ROLE_NAMES.ReadinessOracle.stage).toBe('Readiness');
    expect(ORACLE_ROLE_NAMES.WorkflowOracle.stage).toBe('Workflow');
    expect(ORACLE_ROLE_NAMES.GovernanceOracle.stage).toBe('Governance');
    expect(ORACLE_ROLE_NAMES.BuildOracle.stage).toBe('SoftwareBuild');
  });

  it('oracleRoleForGateIndex returns the named role for every gate', () => {
    expect(oracleRoleForGateIndex(0)).toBe('NeedOracle');
    expect(oracleRoleForGateIndex(1)).toBe('ReadinessOracle');
    expect(oracleRoleForGateIndex(2)).toBe('WorkflowOracle');
    expect(oracleRoleForGateIndex(3)).toBe('GovernanceOracle');
    expect(oracleRoleForGateIndex(4)).toBe('BuildOracle');
    expect(oracleRoleForGateIndex(99)).toBeNull();
  });

  it('Elder gates are 0 and 4', () => {
    expect(ELDER_ORACLE_GATE_INDEXES).toEqual([0, 4]);
    expect(isElderGate(0)).toBe(true);
    expect(isElderGate(4)).toBe(true);
    expect(isElderGate(1)).toBe(false);
    expect(isElderGate(2)).toBe(false);
    expect(isElderGate(3)).toBe(false);
  });
});

describe('TAG Oracle Council — Elder attestation', () => {
  it('passes silently when the gate is not an Elder gate', () => {
    expect(() => assertElderOracleAttested({ elderOracleUserId: null }, 'user-1', 1)).not.toThrow();
    expect(() => assertElderOracleAttested({ elderOracleUserId: null }, 'user-1', 2)).not.toThrow();
    expect(() => assertElderOracleAttested({ elderOracleUserId: null }, 'user-1', 3)).not.toThrow();
  });

  it('throws FORGE_GATE_LOCKED when the mission lacks an Elder Oracle', () => {
    try {
      assertElderOracleAttested({ elderOracleUserId: null }, 'user-1', 0);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ForgeError);
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.GATE_LOCKED);
    }
    try {
      assertElderOracleAttested({ elderOracleUserId: null }, 'user-1', 4);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ForgeError);
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.GATE_LOCKED);
    }
  });

  it('throws FORGE_ATTRIBUTION_MISSING when the approver is not the Elder', () => {
    try {
      assertElderOracleAttested({ elderOracleUserId: 'elder-1' }, 'random-user', 0);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ForgeError);
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.ATTRIBUTION_MISSING);
    }
    try {
      assertElderOracleAttested({ elderOracleUserId: 'elder-1' }, 'random-user', 4);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ForgeError);
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.ATTRIBUTION_MISSING);
    }
  });

  it('passes when the named Elder approves', () => {
    expect(() =>
      assertElderOracleAttested({ elderOracleUserId: 'elder-1' }, 'elder-1', 0),
    ).not.toThrow();
    expect(() =>
      assertElderOracleAttested({ elderOracleUserId: 'elder-1' }, 'elder-1', 4),
    ).not.toThrow();
  });
});

describe('TAG Oracle Council — specialist attesters', () => {
  it('throws FORGE_ATTRIBUTION_MISSING when no attesters are present', () => {
    try {
      assertSpecialistAttestersPresent({ attesterUserIds: [] }, 1);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ForgeError);
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.ATTRIBUTION_MISSING);
    }
  });

  it('passes when at least one specialist has signed the handoff', () => {
    expect(() =>
      assertSpecialistAttestersPresent({ attesterUserIds: ['specialist-1'] }, 2),
    ).not.toThrow();
  });
});
