// @polsia:user-owned — additive ReleaseSource upsert side-effect. Called
// from POST /api/forge/missions/[id]/release AFTER recordRelease() succeeds.
// Idempotent (upsert on missionId @unique), tolerant of failure (logs +
// continues — never breaks the visible contract).
import 'server-only';
import type { ReleaseActorT } from '@/lib/contracts/telemetry';
import { prisma } from '@/lib/db';
import { deriveReleaseActor } from './telemetry-service';

export interface RecordReleaseSourceArgs {
  missionId: string;
  missionCreatedById: string; // scalar FK to User; no @relation
  decidedById?: string;
  reasonText?: string;
  releaserIsHuman: boolean; // true when the caller's role is human (non-system)
  handoffsForAge: ReadonlyArray<{ createdAt: Date; supersededById: string | null }>;
  approvalsWithActorTags: ReadonlyArray<{
    decision: 'Approve' | 'Return' | 'Refuse';
    id?: string;
  }>;
  actorTagsByApproval: ReadonlyMap<string, ReadonlyArray<{ actorKind: string }>>;
}

export async function recordReleaseSourceOnPostRelease(
  args: RecordReleaseSourceArgs,
): Promise<void> {
  try {
    const draftCapturedAt = pickDraftCapturedAt(args.handoffsForAge);
    const derived = deriveReleaseActor(
      args.approvalsWithActorTags.map((a) => ({ decision: a.decision, id: a.id })),
      args.actorTagsByApproval,
    );
    const actor: ReleaseActorT = args.releaserIsHuman
      ? derived === 'AIOnly'
        ? 'Hybrid' // a Human pressed the button — at least one human was in the loop
        : derived
      : derived;
    const data = {
      actor,
      decidedById: args.decidedById ?? null,
      draftCapturedAt,
      reasonText: args.reasonText ?? null,
    };
    await prisma.releaseSource.upsert({
      where: { missionId: args.missionId },
      create: {
        missionId: args.missionId,
        actor,
        decidedById: data.decidedById,
        draftCapturedAt: data.draftCapturedAt,
        reasonText: data.reasonText,
      },
      update: data,
    });
  } catch (_err) {}
}

function pickDraftCapturedAt(
  handoffs: ReadonlyArray<{ createdAt: Date; supersededById: string | null }>,
): Date {
  const live = handoffs.filter((h) => !h.supersededById);
  if (live.length === 0) return new Date();
  const seed = live[0];
  if (!seed) return new Date();
  const oldest = live.reduce(
    (acc, h) => (h.createdAt.getTime() < acc.getTime() ? h.createdAt : acc),
    seed.createdAt,
  );
  return oldest;
}
