// @polsia:user-owned — the presentation adapter must cover every enum value
// in the contracts and never leak a raw code / zero-based gate number.
import { describe, expect, it } from 'vitest';
import {
  APPROVAL_DECISION_VALUES,
  GATE_DEFS,
  GATE_REASON_CODES,
  MissionStatusValues,
  ORACLE_ROLE_VALUES,
  StageNameValues,
} from '@/lib/contracts/forge';
import {
  approvalNameForIndex,
  DECISION_OPTIONS,
  DECISION_UI,
  defaultReasonFor,
  draftDecisionNote,
  humanise,
  humaniseCopy,
  REASON_UI,
  ROLE_UI,
  roleLabel,
  STAGE_UI,
  STATUS_TONE,
  STATUS_UI,
  STEPS,
  stageUiForIndex,
  stepLabel,
  stepNumberLabel,
} from '@/lib/ui-terms';

const RAW_NEVER_SHOWN = [
  'EvidenceRequested',
  'ScopeMismatch',
  'UserCorrection',
  'ReplayRequired',
  'ElderOracle',
  'InDiscovery',
  'SoftwareBuild',
];

describe('STAGE_UI', () => {
  it('covers every stage with a one-based number in order', () => {
    expect(Object.keys(STAGE_UI).sort()).toEqual([...StageNameValues].sort());
    expect(STEPS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
    expect(STEPS.map((s) => s.stage)).toEqual([...StageNameValues]);
  });

  it('uses the brief’s exact labels', () => {
    expect(STAGE_UI.Discovery).toMatchObject({
      number: 1,
      short: 'Understand',
      title: 'Define the need',
      action: 'Confirm need and continue',
    });
    expect(STAGE_UI.SoftwareBuild).toMatchObject({
      number: 5,
      short: 'Make',
      title: 'Approve the prototype',
      action: 'Approve prototype package',
    });
  });

  it('gives every step one sentence that never claims a production deployment', () => {
    for (const step of STEPS) {
      expect(step.sentence.length, step.stage).toBeGreaterThan(20);
      expect(step.sentence, step.stage).not.toMatch(/deploy(ed|able)? (to )?production/i);
    }
    expect(STAGE_UI.SoftwareBuild.sentence).toMatch(/prototype/i);
  });

  it('maps a zero-based gate index to a one-based step, safely', () => {
    expect(stageUiForIndex(0).number).toBe(1);
    expect(stageUiForIndex(4).number).toBe(5);
    expect(stageUiForIndex(99).number).toBe(1);
    expect(stepNumberLabel(2)).toBe('Step 3');
    expect(stepLabel('Workflow')).toBe('Step 3 · Design the workflow');
    expect(approvalNameForIndex(1)).toBe('Check readiness — approval');
  });
});

describe('STATUS_UI', () => {
  it('covers every mission status with a plain-language label and a tone', () => {
    for (const status of MissionStatusValues) {
      expect(STATUS_UI[status], status).toBeTruthy();
      expect(STATUS_TONE[status], status).toBeTruthy();
    }
    expect(STATUS_UI.AwaitingApproval).toBe('Needs approval');
    expect(STATUS_UI.Blocked).toBe('Needs information');
    expect(STATUS_UI.RolledBack).toBe('Earlier version restored');
  });

  it('never shows the raw enum (Draft/Paused are already plain words)', () => {
    for (const status of MissionStatusValues) {
      if (status === 'Draft' || status === 'Paused') continue;
      expect(STATUS_UI[status]).not.toBe(status);
    }
  });
});

describe('decisions and reasons', () => {
  it('covers every approval decision and reason code', () => {
    expect(Object.keys(DECISION_UI).sort()).toEqual([...APPROVAL_DECISION_VALUES].sort());
    expect(Object.keys(REASON_UI).sort()).toEqual([...GATE_REASON_CODES].sort());
    expect(DECISION_OPTIONS.map((o) => o.value)).toEqual([
      'Approve',
      'ApproveWithControls',
      'Return',
      'Refuse',
    ]);
    expect(DECISION_UI.ApproveWithControls).toBe('Approve with conditions');
    expect(DECISION_UI.Return).toBe('Ask for changes');
    expect(DECISION_UI.Refuse).toBe('Stop this project');
  });

  it('reason labels never equal the raw code (except Approved)', () => {
    for (const code of GATE_REASON_CODES) {
      if (code === 'Approved') continue;
      expect(REASON_UI[code]).not.toBe(code);
    }
  });

  it('picks a default reason the gate actually allows', () => {
    for (const gate of GATE_DEFS) {
      for (const decision of APPROVAL_DECISION_VALUES) {
        const code = defaultReasonFor(decision, gate.id);
        expect(gate.allowedReasonCodes, `${decision} @ gate ${gate.id}`).toContain(code);
      }
    }
    expect(defaultReasonFor('Approve', 0)).toBe('Approved');
    expect(defaultReasonFor('Refuse', 0)).toBe('WalkAway');
  });

  it('drafts an editable note that names the step, not the gate', () => {
    const note = draftDecisionNote('Approve', 'Readiness');
    expect(note).toContain('step 2');
    expect(note).not.toMatch(/gate/i);
  });
});

describe('roles', () => {
  it('covers every council role', () => {
    expect(Object.keys(ROLE_UI).sort()).toEqual([...ORACLE_ROLE_VALUES].sort());
    expect(roleLabel('ElderOracle')).toBe('Council Chair');
    expect(roleLabel('SomethingNew')).toBe('Something new');
  });
});

describe('humaniseCopy', () => {
  it('rewrites zero-based gates and internal nouns', () => {
    expect(humaniseCopy('Approve Gate 2 for the SoftwareBuild stage')).toBe(
      'Approve Step 3 for the Approve the prototype stage',
    );
    expect(humaniseCopy('Elder Oracle must sign this handoff')).toBe(
      'Council Chair must sign this step output',
    );
    expect(humaniseCopy('Agent 3 raised an objection on the mission')).toBe(
      'CariForge raised a concern on the project',
    );
  });

  it('never leaves a raw code in the output of the maps', () => {
    const everything = [
      ...Object.values(STATUS_UI),
      ...Object.values(REASON_UI),
      ...Object.values(ROLE_UI),
      ...Object.values(DECISION_UI),
    ].join(' ');
    for (const raw of RAW_NEVER_SHOWN) expect(everything).not.toContain(raw);
  });

  it('humanise splits camel case', () => {
    expect(humanise('EvidenceRequested')).toBe('Evidence requested');
  });
});
