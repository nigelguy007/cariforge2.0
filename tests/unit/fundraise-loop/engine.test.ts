// @polsia:user-owned — pins the fundraise loop's safety + re-aiming rules.
import { describe, expect, it } from 'vitest';
import {
  apportion,
  planAllocation,
  type SegmentInput,
  segmentEvidence,
} from '@/lib/business/fundraise-loop/allocation';
import {
  dedupeKeyFor,
  dedupeKeyForIdentifier,
  linkedinHandle,
} from '@/lib/business/fundraise-loop/dedupe';
import { canSend, canTransition, laneFor } from '@/lib/business/fundraise-loop/state';

const NOW = new Date('2026-09-29T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const CFG = {
  batchSize: 40,
  minSegmentShare: 0.1,
  explorationFloor: 0.05,
  minTrialsBeforeCut: 100,
  minWeeksRunway: 8,
};

function seg(key: string, over: Partial<SegmentInput> = {}): SegmentInput {
  return { key, status: 'ACTIVE', estUniverse: 5000, lagDays: 21, contacted: 0, sent: [], ...over };
}
function sent(n: number, ageDays: number, events: string[] = []) {
  return Array.from({ length: n }, () => ({ sentAt: daysAgo(ageDays), events }));
}
const total = (r: ReturnType<typeof planAllocation>) => r.reduce((s, x) => s + x.allocation, 0);

describe('dedupe', () => {
  it('normalises every LinkedIn URL form to one handle', () => {
    for (const u of [
      'https://www.linkedin.com/in/Jane-Doe/',
      'http://linkedin.com/in/jane-doe?trk=abc',
      'linkedin.com/in/jane-doe#x',
      'https://uk.linkedin.com/in/jane-doe',
    ]) {
      expect(linkedinHandle(u)).toBe('jane-doe');
    }
  });
  it('prefers LinkedIn over email over name+firm', () => {
    expect(dedupeKeyFor({ linkedinUrl: 'linkedin.com/in/a', email: 'x@y.com' })).toBe('li:a');
    expect(dedupeKeyFor({ email: ' X@Y.com ' })).toBe('em:x@y.com');
    expect(dedupeKeyFor({ fullName: 'José  Pérez', firm: 'Acme, Ltd.' })).toBe(
      'nf:jose perez|acme ltd',
    );
    expect(dedupeKeyFor({ fullName: 'Only Name' })).toBeNull();
  });
  it('resolves import identifiers into the same key space', () => {
    expect(dedupeKeyForIdentifier('https://linkedin.com/in/a/')).toBe('li:a');
    expect(dedupeKeyForIdentifier('X@y.com')).toBe('em:x@y.com');
    expect(dedupeKeyForIdentifier('José Pérez | Acme Ltd')).toBe('nf:jose perez|acme ltd');
    expect(dedupeKeyForIdentifier('garbage')).toBeNull();
  });
});

describe('state machine (approval gate)', () => {
  it('cannot send without approval or with the kill switch off', () => {
    expect(canTransition('PENDING_APPROVAL', 'SENT')).toBe(false);
    expect(canTransition('APPROVED', 'SENT')).toBe(true);
    expect(canTransition('SENT', 'APPROVED')).toBe(false);
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(canSend('APPROVED', false)).toBe(false);
    expect(canSend('PENDING_APPROVAL', true)).toBe(false);
    expect(canSend('APPROVED', true)).toBe(true);
  });
  it('routes warm-path prospects away from cold sends', () => {
    expect(laneFor('Intro via Ana (board)')).toBe('WARM');
    expect(laneFor('  ')).toBe('COLD');
    expect(laneFor(undefined)).toBe('COLD');
  });
});

describe('evidence', () => {
  it('silent contacts only count as trials after the lag window', () => {
    const e = segmentEvidence(seg('a', { lagDays: 45, sent: sent(10, 20) }), NOW);
    expect(e.matured).toBe(0);
    const e2 = segmentEvidence(seg('a', { lagDays: 45, sent: sent(10, 50) }), NOW);
    expect(e2.matured).toBe(10);
  });
  it('meetings are full successes, replies only partial', () => {
    const e = segmentEvidence(
      seg('a', { sent: [...sent(1, 5, ['REPLY', 'MEETING']), ...sent(2, 5, ['REPLY'])] }),
      NOW,
    );
    expect(e.matured).toBe(3);
    expect(e.successes).toBeCloseTo(1.5);
    expect(e.meetings).toBe(1);
    expect(e.replies).toBe(3);
  });
});

describe('allocation', () => {
  it('fills the batch exactly and splits evenly with no data', () => {
    const r = planAllocation([seg('a'), seg('b'), seg('c'), seg('d')], CFG, NOW);
    expect(total(r)).toBe(40);
    for (const x of r) {
      expect(x.allocation).toBeGreaterThanOrEqual(4);
      expect(x.recommendation).toBe('insufficient-data');
    }
  });

  it('does not starve a segment on thin early data', () => {
    const r = planAllocation(
      [
        seg('fo', { contacted: 20, sent: sent(20, 30, []).concat(sent(2, 30, ['MEETING'])) }),
        seg('pension', { contacted: 20, lagDays: 60, sent: sent(20, 30) }),
      ],
      CFG,
      NOW,
    );
    const pension = r.find((x) => x.key === 'pension');
    expect(pension?.allocation).toBeGreaterThanOrEqual(4); // floor held (10% of 40)
    expect(pension?.maturedTrials).toBe(0); // still inside its 60-day lag
  });

  it('leans in to a proven segment once evidence is sufficient', () => {
    const r = planAllocation(
      [
        seg('good', { contacted: 150, sent: [...sent(130, 40), ...sent(20, 40, ['MEETING'])] }),
        seg('bad', { contacted: 150, sent: sent(150, 40) }),
      ],
      CFG,
      NOW,
    );
    const good = r.find((x) => x.key === 'good');
    const bad = r.find((x) => x.key === 'bad');
    expect(good?.allocation).toBeGreaterThan(30);
    expect(bad?.allocation).toBeGreaterThanOrEqual(1); // exploration floor, never zero
    expect(bad?.recommendation).toBe('consider-pausing');
    expect(good?.recommendation).toBe('lean-in');
  });

  it('caps burn so a small market lasts at least minWeeksRunway', () => {
    const r = planAllocation(
      [seg('tiny', { estUniverse: 80, contacted: 0 }), seg('big')],
      { ...CFG, minSegmentShare: 0.5 },
      NOW,
    );
    const tiny = r.find((x) => x.key === 'tiny');
    expect(tiny?.allocation).toBeLessThanOrEqual(10); // 80 / 8 weeks
    expect(total(r)).toBe(40); // freed capacity redistributed
  });

  it('gives paused and exhausted segments nothing', () => {
    const r = planAllocation(
      [seg('p', { status: 'PAUSED' }), seg('x', { estUniverse: 10, contacted: 10 }), seg('ok')],
      CFG,
      NOW,
    );
    expect(r.find((x) => x.key === 'p')?.allocation).toBe(0);
    expect(r.find((x) => x.key === 'x')?.allocation).toBe(0);
    expect(r.find((x) => x.key === 'x')?.recommendation).toBe('exhausted');
    expect(r.find((x) => x.key === 'ok')?.allocation).toBe(40);
  });

  it('is deterministic for a given seed', () => {
    const input = [seg('a', { contacted: 5, sent: sent(5, 30, ['MEETING']) }), seg('b')];
    expect(planAllocation(input, CFG, NOW, 7)).toEqual(planAllocation(input, CFG, NOW, 7));
  });

  it('apportion never exceeds caps or total', () => {
    const out = apportion({ a: 0.7, b: 0.3 }, { a: 3, b: 100 }, 10);
    expect(out.a).toBe(3);
    expect((out.a ?? 0) + (out.b ?? 0)).toBe(10);
  });
});
