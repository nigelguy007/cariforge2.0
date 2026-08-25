// @polsia:user-owned — GET /api/council. Static catalog copy for the
// /how-the-council-works depth page: the five advisor roles, the chairman's
// three-ruling logic, and the tie-back-to-human rule. Served from in-process
// `as const` constants with no DB. The route parses through the shared
// CouncilDetail contract so the page can rely on the same shape on both
// ends of the wire.

import 'server-only';
import { NextResponse } from 'next/server';
import { CouncilDetail } from '@/lib/contracts/council';

export const dynamic = 'force-dynamic';

const ADVISORS = [
  {
    id: 'risk',
    ordinal: 1,
    role: 'Risk',
    roleLong: 'Risk agent',
    argues:
      'The risks of the brief as written, opened first and most loudly. Surfaces compliance gaps, model risk, and breach exposure before any other voice.',
    dissent:
      'Anything the brief presents as safe-by-default that would not hold under audit: an unsupported lawful-basis claim, an unscoped personal-data flow, a model call that has no logging.',
    default: 'Objection',
    quote: 'What breaks if this fails in production — and who proves it didn’t?',
  },
  {
    id: 'demand',
    ordinal: 2,
    role: 'Demand',
    roleLong: 'Demand agent',
    argues:
      'Whether there is a real user behind the brief, or only a stakeholder with budget. Pressure-tests the evidence for the problem against pilots, usage data, and named accounts.',
    dissent:
      'A brief that names no user, names no evidence, or names only an internal champion — the demand agent treats this as the case resting on claim rather than observation.',
    default: 'Supports',
    quote: 'Is there a real user behind this, or is this a stakeholder pattern?',
  },
  {
    id: 'growth',
    ordinal: 3,
    role: 'Growth',
    roleLong: 'Growth agent',
    argues:
      'Whether solving this unlocks anything downstream, or whether it is a one-off ask that the forge will spend its runway on and the buyer will discard after delivery.',
    dissent:
      'A brief whose only measure of success is the Software Build being shipped — no downstream capability, no reuse, no second problem it unlocks — is treated as one-off work and a poor forge target.',
    default: 'Qualifies',
    quote: 'Does solving this unlock a second thing, or does it end at the Software Build?',
  },
  {
    id: 'competition',
    ordinal: 4,
    role: 'Competition',
    roleLong: 'Competition agent',
    argues:
      'Whether a credible off-the-shelf tool already does this, and — if it does — what the buyer would actually pay the forge to add. Demands build-vs-buy be decided explicitly and by name.',
    dissent:
      'A brief that, on inspection, is a thin wrapper over a vendor product the buyer already licenses — the competition agent forces the build case to be made or the run is walked away from.',
    default: 'Qualifies',
    quote: 'Could a credible off-the-shelf tool already do this? If so, what is the build case?',
  },
  {
    id: 'money',
    ordinal: 5,
    role: 'Money',
    roleLong: 'Money agent',
    argues:
      'Whether the unit economics are honest at the scale the buyer expects. Refuses numbers that depend on the AI behaving differently later, on margin compressing, or on a payback that requires the buyer’s context to stay frozen.',
    dissent:
      'Any unit-economics case whose assumptions regress to "the model will improve", "the buyer will grow into it", or "the cost will fall next year" — the money agent objects on all three.',
    default: 'Objection',
    quote:
      'Are the unit economics honest at the scale we expect, or do they depend on the future behaving well?',
  },
] as const;

const CHAIRMANSHIP = [
  {
    id: 'build',
    ordinal: 1,
    verdict: 'Build',
    whatItMeans:
      'The ruling authorises the forge to advance the case to the next stage. The work that follows is owned by named humans, not by the council — the council’s job on this verdict is over.',
    dissentRecordedAs:
      'Any dissenting advisor’s written objection is appended verbatim into the case file as a timestamped dissent record — dissenting voice named by role, timestamp attached — before the forge advances the case to the next stage.',
  },
  {
    id: 'test-first',
    ordinal: 2,
    verdict: 'Test first',
    whatItMeans:
      'The ruling pauses the forge at the current stage and routes the case back through a bounded test or pilot before any further advance. The case file records the test scope and what would move the ruling to Build.',
    dissentRecordedAs:
      'The dissent is recorded as the test scope itself: which advisor asked for the test, what they asked to be tested against, what outcome would resolve the objection, and at what stage the test results will be re-read into the case file.',
  },
  {
    id: 'walk-away',
    ordinal: 3,
    verdict: 'Walk away',
    whatItMeans:
      'The ruling stops the forge at the current stage and closes the case. Walk-away is a final ruling — the case does not auto-reopen on a later brief, and reopenings require a new inbound brief and a fresh council.',
    dissentRecordedAs:
      'The dissent is recorded as the close reason, attached to the case file as a closure record with the dissenting advisor named by role, the reason quoted verbatim, and a typed recommendation for what a future brief would need to do differently.',
  },
] as const;

const TIEBREAK = [
  {
    id: 'when-the-chair-stops',
    ordinal: 1,
    rule: 'When the council cannot settle the case after one round of debate, the chair stops the run.',
    mechanism:
      'The chair halts the forge at the current stage and surfaces the case to the named human approver — the run does not advance, the Software Build is not produced, and the next stage does not start.',
    whoSigns:
      'The human approver named on the case file — the named human attached to the brief from intake. The chairman never signs, and no other voice on the council signs in their place.',
    whatTheyAttach:
      'A typed reason, recorded verbatim alongside the stage advance. The ruling — approve, return, or refuse — is filed with the reason attached, before any next stage begins.',
    appliesTo:
      'The five stage gates of the 21-day delivery pipeline — Stage 1: Discovery, Stage 2: Readiness, Stage 3: Workflow, Stage 4: Governance, Stage 5: Software Build — not just the chair’s tie-break block. Every stage advance requires the same named-human approval with a typed reason attached. The seven-agent core (Agents 1..7: Discovery, Readiness, Workflow, Governance, AI Build, Partner, Impact) operates these stages — Agent 5 (AI Build) runs Stage 5 (Software Build); Agents 6 (Partner) and 7 (Impact) wrap around delivery. The named-human gate is per stage, not per agent.',
  },
  {
    id: 'no-silent-drop',
    ordinal: 2,
    rule: 'An unresolved objection is never silently dropped from the case file.',
    mechanism:
      'If the chair rules without a tie-break, the dissent still travels with the case: it is appended to the audit trail as a verbatim dissent record at every stage advance, so a compliance officer can re-read it later.',
    whoSigns:
      'The dissenting advisor — by role — not by a re-cast name. The dissent’s author is preserved so the objection can be appealed to the named human later if the buyer changes their mind.',
    whatTheyAttach:
      'The verbatim objection recorded at the time it was raised, plus the resolution that addressed it — whether the chair overruled it, the buyer overrode it, or it carried into the next stage unaddressed.',
    appliesTo:
      'Every stage gate, not just the council’s deliberation. If an objection is left unresolved at a stage advance, it must be carried forward — never silently dropped — and re-read at the next human gate.',
  },
  {
    id: 'no-averaging',
    ordinal: 3,
    rule: 'The chair never averages a contested point. A ruling is a verdict, not a midpoint between opposing voices.',
    mechanism:
      'When two or more agents disagree on the same point, the chair is required to escalate to the named human — averaging is not an available ruling. The chair picks one of Build, Test first, or Walk away only when no opposing voice has weighed in on the same point.',
    whoSigns:
      'The named human approver attached to the case file, by name. The chairman’s name is attached only as the party who escalated, not as a signatory on the substantive ruling.',
    whatTheyAttach:
      'A typed reason that names which side of the contested point the approver is siding with, and why — not a generic "approved" or "returned". Approve, return, or refuse is recorded verbatim.',
    appliesTo:
      'Any contested point where two or more voices disagree, at any stage of the run. Averaging is structurally unavailable as a ruling shape.',
  },
] as const;

export async function GET() {
  return NextResponse.json(
    CouncilDetail.parse({
      advisors: ADVISORS,
      chairmanship: CHAIRMANSHIP,
      tiebreak: TIEBREAK,
    }),
  );
}
