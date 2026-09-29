// @polsia:user-owned — GET /api/faq. Static catalog of regulated-buyer
// objections, served from an in-process constant (no DB). The PAGE goes through
// this handler anyway because the project rule bans data-fetch in Server
// Components, and a client `apiFetch('/api/faq')` keeps the contract shape
// consistent with every other resource.

import 'server-only';
import { NextResponse } from 'next/server';
import { FaqList } from '@/lib/contracts/faq';

const FAQ = [
  {
    id: 'eu-ai-act-articles-12-14',
    ordinal: 1,
    question:
      'How does CariForge align with EU AI Act Articles 12 and 14, and what does the timeline look like?',
    answer:
      "Articles 12 (record-keeping for high-risk AI) and 14 (effective oversight by natural persons) reach high-risk systems from 2 August 2026, with the Commission's biennial review starting 2 August 2027. CariForge's pipeline is shaped for them: every stage emits a timestamped, named-human approval record so the Article 12 logging and Article 14 human-in-the-loop expectations are produced as a by-product of the work, not added afterwards.",
  },
  {
    id: 'audit-trail-evidence',
    ordinal: 2,
    question: 'What evidence does the audit trail produce, and where is it stored?',
    answer:
      "Five artefacts per run: the verbatim brief, the council debate transcript, the chairman's typed ruling, the human gate decision with reason, and the finished-solution receipt. They are persisted server-side as append-only JSON with a SHA-256 hash chain between successive artefacts, so a compliance officer can replay the case end-to-end and any tampering breaks the chain. The full bundle is exportable on request as a single signed JSON; a 90-day retention minimum is the current default.",
  },
  {
    id: 'hallucination-council',
    ordinal: 3,
    question: 'How do you stop unsupported claims from reaching the working prototype?',
    answer:
      'No claim is allowed to stand on one voice. Inside the 7-agent engine, a five-voice review council (Risk, Demand, Growth, Competition and Money, known as the Oracles) argues each gate before the named human signs. Each voice opens objections by default, and a chairman rules only when at least two opposing voices have weighed in on the same point. Any unresolved objection is escalated to the named human, never silently dropped. The model is asked to argue the case, and no confidence score replaces that argument.',
  },
  {
    id: 'scaffold-vs-product',
    ordinal: 4,
    question: 'What does CariForge actually hand over — and what does it not?',
    answer:
      'A 21-day pilot ends in a Decision Pack the client owns: problem brief, readiness score, workflow map, governance review, working prototype and full audit trail. The working prototype is a runnable codebase that the client owns and operates. The pilot does not include production hosting, an uptime SLA, 24/7 support, regulatory certification or liability for downstream deployment. CariForge’s responsibility ends at the hand-off receipt, and the handover note names the people who would own the next steps.',
  },
  {
    id: 'why-a-council',
    ordinal: 5,
    question: 'Why is a council shape needed at all?',
    answer:
      'A single model asked to be careful under load converges to hedging rather than honesty, which a compliance audit later catches as fabricated certainty. Five voices with opposing defaults force the disagreement to surface in the artefact, and a human tiebreaker keeps an unattended edge case from being averaged away. Solo AI judgement on regulated work fails in a known way, and the council is there to catch it.',
  },
] as const;

export async function GET() {
  return NextResponse.json(FaqList.parse({ items: FAQ }));
}
