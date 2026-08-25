// @polsia:user-owned — honest gap list. These strings are rendered on the
// mission detail page AND asserted in tests/unit/forge/gaps.test.ts so a
// future implementer can't silently remove a known gap.

export interface GapEntry {
  readonly title: string;
  readonly detail: string;
}

export const FORGE_GAPS: readonly GapEntry[] = [
  {
    title: 'No specialist runtime wired',
    detail:
      'The control plane stores contracts and decisions; the lifecycle-specialists track fills in agent execution later. ToolAction rows describe intent and resolve approval but do not invoke a domain specialist.',
  },
  {
    title: 'No real external integrations',
    detail:
      'ToolAction requests are recorded and policies are enforced, but the executor is a deterministic no-op stub returning a synthetic success payload. Wiring a vendor (e.g. a build runner) is a follow-on against the same ToolAction rows.',
  },
  {
    title: 'No multi-tenant separation',
    detail:
      'Single shared workspace per auth account. A future build that needs strict tenant isolation would scope queries by tenantId or workspaceId derived from the auth account.',
  },
  {
    title: 'TAG Caribbean / Mirror workflows explicitly excluded',
    detail:
      'No domain-specific specialists, no TAG/Mirror hard-coded flows. The forge is intentionally domain-agnostic.',
  },
  {
    title: 'No marketplace, no AGI claim',
    detail:
      'The forge organises software-delivery missions. It does not point at any external agent network and makes no claim of autonomous general intelligence.',
  },
  {
    title: 'Confidence is interpretable, not predictive',
    detail:
      'recomputeConfidence mixes handoff confidence with missing-evidence penalty as a deterministic interpretable score. It is NOT a probabilistic or ML-derived prediction.',
  },
  {
    title: 'Bounded work items wired',
    detail:
      'A first-class WorkItem model lets the operator split an approved Workflow gate into per-item scope + acceptance criteria + test evidence. Status transitions are bounded and asserted in tests/unit/forge/work-items.test.ts.',
  },
  {
    title: 'Reusable blueprint + runbook view',
    detail:
      'After SoftwareBuild, /api/forge/missions/[id]/blueprint and /runbook return derived typed payloads. The page is a thin shell that renders the client island; the data lives inside the StageHandoff payload + audit log.',
  },
  {
    title: 'Mission Control next-action panel',
    detail:
      'nextActionFor(input) computes the next human action from MissionStatus + outstanding objections + outstanding tool decisions + work-item state. The Mission Control UI surfaces this without raw chain-of-thought.',
  },
  {
    title: 'Release readout tracked',
    detail:
      'Mission.releaseReadoutAt is populated by POST /api/forge/missions/[id]/release and exposed via /api/forge/missions/[id]/release (GET). deriveReleaseStatus produces a stable enum (Released, BuildApprovedNotReleased, Paused, …) sourced from mission state + last approval + last executed tool action.',
  },
];
