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
      'How does CARI Forge align with EU AI Act Articles 12 and 14, and what does the timeline look like?',
    answer:
      "Articles 12 (record-keeping for high-risk AI) and 14 (effective oversight by natural persons) reach high-risk systems from 2 August 2026, with the Commission's biennial review starting 2 August 2027. CARI Forge's pipeline is shaped for them: every stage emits a timestamped, named-human approval record so the Article 12 logging and Article 14 human-in-the-loop expectations are produced as a by-product of the work, not added afterwards.",
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
    question: 'How do you stop hallucinated claims from reaching the Software Build?',
    answer:
      'No claim is allowed to stand on one voice. Each agent opens objections by default and is tuned to a single angle — Risk, Demand, Growth, Competition, Money — and a chairman rules only when at least two opposing voices have weighed in on the same point. Any unresolved objection is escalated to the named human, never silently dropped. This is structural disagreement, not confidence scoring: the model is asked to argue, not to declare certainty.',
  },
  {
    id: 'scaffold-vs-product',
    ordinal: 4,
    question: 'What does CARI Forge actually hand over — and what does it not?',
    answer:
      "CARI Forge delivers a runnable, fully-typed Next.js Software Build from a one-line brief; it does not deliver a production-deployable system, ongoing maintenance, regulatory certification, or any acceptance that the Software Build meets the buyer's specific audit regime. Each hand-off says plainly what is in the box and what is not, the runway ends at the Software Build receipt, and the handover note names the named humans who would own the next steps.",
  },
  {
    id: 'why-a-council',
    ordinal: 5,
    question: 'Why is a council shape needed at all?',
    answer:
      'A single model asked to be careful under load converges to hedging rather than honesty, which a compliance audit later catches as fabricated certainty. Five voices with opposing defaults force the disagreement to surface in the artefact, and a human tiebreaker keeps an unattended edge case from being averaged away. The shape exists because the failure mode of solo AI judgement on regulated work is well understood, not because it is decorative.',
  },
] as const;

export async function GET() {
  return NextResponse.json(FaqList.parse({ items: FAQ }));
}
