// @polsia:user-owned — real user reports, in order:
// "it says there are 3 outstanding concerns unresolved .. yet the system
// says they are resolved" (fixed by carryForwardStaleObjections running
// at the moment a handoff goes stale), then "system says 2 unresolved
// concerns but nothing there" on a DIFFERENT mission — data created
// BEFORE that write path existed, which a going-forward fix can never
// reach. findOrphanedObjectionIds is the pure logic behind
// getMissionDetail's self-heal: every read re-checks for exactly this
// orphaned state (an unresolved objection on an already-stale handoff)
// and the caller resolves it in place, so the fix reaches every mission
// the next time anyone actually opens it — not just ones redrafted after
// the fix shipped. isStaleHandoff is the single canonical predicate this
// shares with supporting-detail.tsx's partitionObjections, so "is this
// handoff stale" can never quietly drift into two different answers.
import { describe, expect, it } from 'vitest';
import { findOrphanedObjectionIds, isStaleHandoff } from '@/lib/business/forge/handoffs';

function handoff(over: {
  id: string;
  supersededById?: string | null;
  invalidationReasonCode?: string | null;
}) {
  return {
    id: over.id,
    supersededById: over.supersededById ?? null,
    invalidationReasonCode: over.invalidationReasonCode ?? null,
  };
}

function objection(over: { id: string; stageHandoffId: string; resolution?: string | null }) {
  return { id: over.id, stageHandoffId: over.stageHandoffId, resolution: over.resolution ?? null };
}

describe('isStaleHandoff', () => {
  it('is false for a live handoff (neither superseded nor invalidated)', () => {
    expect(isStaleHandoff(handoff({ id: 'h1' }))).toBe(false);
  });
  it('is true once superseded (a fresh handoff replaced it)', () => {
    expect(isStaleHandoff(handoff({ id: 'h1', supersededById: 'h2' }))).toBe(true);
  });
  it('is true once invalidated (marked stale by an upstream redraft/replay/rollback), even with supersededById still null', () => {
    expect(isStaleHandoff(handoff({ id: 'h1', invalidationReasonCode: 'StaleInformation' }))).toBe(
      true,
    );
  });
});

describe('findOrphanedObjectionIds', () => {
  it('finds nothing when every unresolved objection is on a live handoff', () => {
    const handoffs = [handoff({ id: 'h1' })];
    const objections = [objection({ id: 'o1', stageHandoffId: 'h1' })];
    expect(findOrphanedObjectionIds(handoffs, objections)).toEqual([]);
  });

  it('finds an unresolved objection on a superseded handoff — the exact "3 unresolved .. yet resolved" bug', () => {
    const handoffs = [handoff({ id: 'h1', supersededById: 'h2' }), handoff({ id: 'h2' })];
    const objections = [objection({ id: 'stale-1', stageHandoffId: 'h1' })];
    expect(findOrphanedObjectionIds(handoffs, objections)).toEqual(['stale-1']);
  });

  it('finds an unresolved objection on an INVALIDATED (not superseded) handoff — the "2 unresolved .. nothing there" bug', () => {
    const handoffs = [handoff({ id: 'h1', invalidationReasonCode: 'StaleInformation' })];
    const objections = [objection({ id: 'stale-2', stageHandoffId: 'h1' })];
    expect(findOrphanedObjectionIds(handoffs, objections)).toEqual(['stale-2']);
  });

  it('never touches an already-resolved objection, even on a stale handoff', () => {
    const handoffs = [handoff({ id: 'h1', supersededById: 'h2' })];
    const objections = [objection({ id: 'o1', stageHandoffId: 'h1', resolution: 'Closed' })];
    expect(findOrphanedObjectionIds(handoffs, objections)).toEqual([]);
  });

  it('finds only the orphaned ones in a realistic mixed mission — genuinely current concerns stay untouched', () => {
    const handoffs = [
      handoff({ id: 'h1-v1', supersededById: 'h1-v2' }), // Discovery, redrafted away
      handoff({ id: 'h1-v2' }), // Discovery, current
      handoff({ id: 'h2', invalidationReasonCode: 'StaleInformation' }), // Readiness, invalidated by the Discovery redraft
    ];
    const objections = [
      objection({ id: 'orphan-from-old-discovery', stageHandoffId: 'h1-v1' }),
      objection({ id: 'orphan-from-invalidated-readiness', stageHandoffId: 'h2' }),
      objection({ id: 'genuinely-current', stageHandoffId: 'h1-v2' }),
      objection({ id: 'already-resolved', stageHandoffId: 'h1-v1', resolution: 'OwnerResolved' }),
    ];
    const orphans = findOrphanedObjectionIds(handoffs, objections);
    expect(orphans.sort()).toEqual(
      ['orphan-from-invalidated-readiness', 'orphan-from-old-discovery'].sort(),
    );
  });
});
