// @polsia:user-owned — Home's compact four-state badge must cover every real
// MissionStatus and, critically, must fail safe (never toward "done") for
// any status it hasn't been explicitly taught. See displayStateFor in
// ui-terms.ts.
import { describe, expect, it } from 'vitest';
import { type MissionStatus, MissionStatusValues } from '@/lib/contracts/forge';
import { DISPLAY_STATE_TONE, DISPLAY_STATE_UI, displayStateFor } from '@/lib/ui-terms';

const EXPECTED: Readonly<Record<MissionStatus, 'draft' | 'working' | 'needs_you' | 'done'>> = {
  Draft: 'draft',
  InDiscovery: 'working',
  InReadiness: 'working',
  InWorkflow: 'working',
  InGovernance: 'working',
  InBuild: 'working',
  Paused: 'working',
  AwaitingApproval: 'needs_you',
  Blocked: 'needs_you',
  Rejected: 'done',
  Completed: 'done',
  WalkedAway: 'done',
  RolledBack: 'done',
};

describe('displayStateFor', () => {
  it('covers every real MissionStatus exactly as the spec table maps it', () => {
    expect(MissionStatusValues.length).toBe(Object.keys(EXPECTED).length);
    for (const status of MissionStatusValues) {
      expect(displayStateFor(status), status).toBe(EXPECTED[status]);
    }
  });

  it('gives every one of the four states a label and a tone', () => {
    for (const state of Object.values(EXPECTED)) {
      expect(DISPLAY_STATE_UI[state]).toBeTruthy();
      expect(DISPLAY_STATE_TONE[state]).toBeTruthy();
    }
  });

  it('fails safe: an unrecognised/future status maps to needs_you, never done', () => {
    const future = 'SomeBrandNewStatusNoOneHasTaughtThisMapAbout' as MissionStatus;
    expect(displayStateFor(future)).toBe('needs_you');
    expect(displayStateFor(future)).not.toBe('done');
  });
});
