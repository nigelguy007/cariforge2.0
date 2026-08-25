// @polsia:user-owned — nine-field intake structure coverage.
import { describe, expect, it } from 'vitest';
import { MissionCreate, MissionIntakeStructure } from '@/lib/contracts/forge';

const valid = {
  need: 'Replace the legacy CRM.',
  intendedOutcome: 'A regulated CRM that supports our three reporting regimes.',
  constraints: 'Budget locked at 1.8M. Two FTEs.',
  authorityBoundary: 'Sign-off by CFO + Compliance Officer.',
  dataClassification: 'Personal data + regulated claim data.',
  retentionPolicy: 'Seven years for claim evidence.',
  acceptanceCriteria: 'Regulator sign-off confirmed in IE/FR/DE.',
  nonGoals: 'No broker onboarding in v1. No third-party data enrichment.',
  missionOwner: 'Cari Forge Operator',
};

describe('MissionIntakeStructure', () => {
  it('accepts a complete nine-field intake', () => {
    const parsed = MissionIntakeStructure.parse(valid);
    expect(parsed.need).toContain('CRM');
    expect(parsed.intendedOutcome.length).toBeGreaterThan(0);
  });
  it('rejects when any of the eight required fields is empty', () => {
    for (const field of [
      'need',
      'intendedOutcome',
      'constraints',
      'authorityBoundary',
      'dataClassification',
      'retentionPolicy',
      'acceptanceCriteria',
      'nonGoals',
    ]) {
      const next = { ...valid, [field]: '' };
      const r = MissionIntakeStructure.safeParse(next);
      expect(r.success).toBe(false);
    }
  });
  it('mission owner is optional', () => {
    const { missionOwner: _owner, ...rest } = valid;
    void _owner;
    const parsed = MissionIntakeStructure.parse(rest);
    expect(parsed.missionOwner).toBeUndefined();
  });
});

describe('MissionCreate with structured intake', () => {
  it('parses with optional structured intake + missing information', () => {
    const parsed = MissionCreate.parse({
      intake:
        'We need to replace our legacy CRM with one that supports our three reporting regimes.',
      intakeStructured: valid,
      missingInformation: ['Realistic per-claim volume', 'Regulator named contact'],
    });
    expect(parsed.intakeStructured?.nonGoals).toContain('No broker onboarding');
    expect(parsed.missingInformation).toHaveLength(2);
  });
  it('treats intakeStructured as optional (legacy intake still parses)', () => {
    const parsed = MissionCreate.parse({
      intake:
        'We need to replace our legacy CRM with one that supports our three reporting regimes.',
    });
    expect(parsed.intakeStructured).toBeUndefined();
  });
});
