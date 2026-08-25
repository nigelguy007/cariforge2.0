// @polsia:user-owned — handoff versioning, parent linkage, correction,
// downstream invalidation.
import { describe, expect, it } from 'vitest';
import {
  computeNextVersion,
  markDownstreamInvalidated,
  validateParent,
} from '@/lib/business/forge/handoffs';
import { FORGE_ERROR_CODES, ForgeError } from '@/lib/business/forge/state-machine';
import type { StageName } from '@/lib/contracts/forge';

function ref(stage: StageName, version: number) {
  return {
    id: `h-${stage}-v${version}`,
    stage,
    version,
    parentVersionId: null,
    correctionOfId: null,
    supersededById: null,
  };
}

describe('handoff versioning', () => {
  it('starts at v1 on first handoff for a stage', () => {
    expect(computeNextVersion(null, 'Discovery')).toBe(1);
  });
  it('bumps version on same-stage handoff', () => {
    const v1 = ref('Discovery', 1);
    expect(computeNextVersion(v1, 'Discovery')).toBe(2);
  });
  it('restarts at v1 across stages', () => {
    const v3 = ref('Workflow', 3);
    expect(computeNextVersion(v3, 'Readiness')).toBe(1);
  });
});

describe('handoff parent validation', () => {
  it('accepts same-stage parent with lower version', () => {
    expect(() => validateParent({ ...ref('Discovery', 2) }, ref('Discovery', 1))).not.toThrow();
  });
  it('rejects same-stage parent with same/greater version', () => {
    expect(() => validateParent({ ...ref('Discovery', 2) }, ref('Discovery', 2))).toThrow(
      ForgeError,
    );
    try {
      validateParent({ ...ref('Discovery', 2) }, ref('Discovery', 2));
    } catch (err) {
      expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.VERSION_NOT_PARENT);
    }
  });
  it('accepts cross-stage parent at immediate-predecessor stage', () => {
    expect(() => validateParent({ ...ref('Readiness', 1) }, ref('Discovery', 1))).not.toThrow();
  });
  it('rejects cross-stage parent at distant stage', () => {
    expect(() => validateParent({ ...ref('SoftwareBuild', 1) }, ref('Discovery', 1))).toThrow(
      ForgeError,
    );
  });
  it('null parent is treated as no parent', () => {
    expect(() => validateParent({ ...ref('Discovery', 1) }, null)).not.toThrow();
  });
});

describe('handoff downstream invalidation', () => {
  it('replay from stage 0 invalidates stages 1..4', () => {
    expect(markDownstreamInvalidated(0)).toEqual([
      'Readiness',
      'Workflow',
      'Governance',
      'SoftwareBuild',
    ]);
  });
  it('replay from stage 4 invalidates nothing', () => {
    expect(markDownstreamInvalidated(4)).toEqual([]);
  });
  it('replay from stage 2 invalidates stages 3..4', () => {
    expect(markDownstreamInvalidated(2)).toEqual(['Governance', 'SoftwareBuild']);
  });
});
