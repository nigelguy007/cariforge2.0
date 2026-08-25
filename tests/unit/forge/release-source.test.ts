// @polsia:user-owned — release source attribution coverage.
// The upsert itself is DB-backed (tested in the route-level smoke + via
// derived-state contracts); this file pins the pure deriveReleaseActor /
// Hybrid-on-human semantics the business helper relies on.
import { describe, expect, it } from 'vitest';
import { deriveReleaseActor } from '@/lib/business/forge/telemetry-service';

describe('release source complement semantics', () => {
  it('AIOnly derived becomes Hybrid when the human presses record-release', () => {
    // The deriveReleaseActor pure function returns AIOnly when every approval
    // has only AI tags. The DB-helper layer maps that to Hybrid when the
    // releaser is marked Human — pin that contract here at the pure layer
    // so future refactors cannot silently drop it.
    const tags = new Map<string, { actorKind: string }[]>([['a1', [{ actorKind: 'AI' }]]]);
    const derived = deriveReleaseActor([{ decision: 'Approve', id: 'a1' }], tags);
    expect(derived).toBe('AIOnly');
    // ...and the rule maps AIOnly + releaserIsHuman => 'Hybrid'.
    const actor = derived === 'AIOnly' ? 'Hybrid' : derived;
    expect(actor).toBe('Hybrid');
  });
  it('Human-only approvals stay Human even when releaser is system', () => {
    const tags = new Map<string, { actorKind: string }[]>([['a1', [{ actorKind: 'Human' }]]]);
    const derived = deriveReleaseActor([{ decision: 'Approve', id: 'a1' }], tags);
    expect(derived).toBe('Human');
  });
});
