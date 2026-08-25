// @polsia:user-owned — POST /api/sample-brief/audit-pdf. Renders the
// /sample-brief worked example as a single-page audit-trail PDF: brief,
// council debate, chair ruling, supervisor sign-off, and scaffold
// disclaimer. Server-side composition from the same SAMPLE_BRIEF +
// SCAFFOLD_DISCLAIMER constants the page renders, so the PDF stays in
// sync with the page even when the page island never loads on the
// client side. Public (no auth) — the worked example is editorial
// catalog content. Validates the optional { caseId } body, then composes
// and renders server-side via the user-owned pdf-lib renderer. Lives in
// its own app-owned route because the layout needs a single-page custom
// render the pdf module's generic DocumentSpec dispatcher cannot produce.

import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { renderAuditTrailPdf } from '@/lib/business/audit-trail-pdf';
import { SAMPLE_BRIEF } from '@/lib/business/sample-brief';
import { SCAFFOLD_DISCLAIMER } from '@/lib/business/scaffold-disclaimer';
import type { AuditTrailDocument } from '@/lib/contracts/audit-trail-document';

export const dynamic = 'force-dynamic';

const RequestBody = z
  .object({
    caseId: z.string().min(1).optional(),
  })
  .optional();

export async function POST(req: Request) {
  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }
  const parsed = RequestBody.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_audit_trail_request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const requestedCaseId = parsed.data?.caseId;
  if (requestedCaseId && requestedCaseId !== SAMPLE_BRIEF.runMetadata.caseId) {
    return NextResponse.json(
      { error: 'case_id_not_found', caseId: requestedCaseId },
      { status: 404 },
    );
  }

  const doc: AuditTrailDocument = {
    kind: 'audit-trail',
    header: {
      caseId: SAMPLE_BRIEF.runMetadata.caseId,
      buyerOrg: SAMPLE_BRIEF.runMetadata.buyerOrg,
      submittedOn: SAMPLE_BRIEF.runMetadata.submittedOn,
      closedOn: SAMPLE_BRIEF.runMetadata.closedOn,
      reviewer: SAMPLE_BRIEF.runMetadata.reviewer,
    },
    brief: {
      industry: SAMPLE_BRIEF.brief.industry,
      problemStatement: SAMPLE_BRIEF.brief.problemStatement,
      proposedApproach: SAMPLE_BRIEF.brief.proposedApproach,
      evidence: SAMPLE_BRIEF.brief.evidence,
      mustNotHappen: SAMPLE_BRIEF.brief.mustNotHappen,
    },
    council: SAMPLE_BRIEF.council.map((a) => ({
      role: a.role,
      stance: a.stance,
      objection: a.objection,
      evidenceAskedFor: a.evidenceAskedFor,
    })),
    ruling: {
      verdict: SAMPLE_BRIEF.ruling.verdict,
      reconciliation: SAMPLE_BRIEF.ruling.reconciliation,
      carriedDissent: SAMPLE_BRIEF.ruling.carriedDissent,
    },
    signatures: SAMPLE_BRIEF.stages.map((s) => ({
      agentOrdinal: s.agentOrdinal,
      agentName: s.agentName,
      name: s.supervisor.name,
      role: s.supervisor.role,
      decision: s.supervisor.decision,
      typedReason: s.supervisor.typedReason,
      signedAt: s.supervisor.signedAt,
      elderOracleMatched: s.agentOrdinal === 1 || s.agentOrdinal === 5,
    })),
    disclaimer: SCAFFOLD_DISCLAIMER.map((d) => ({
      headline: d.headline,
      detail: d.detail,
    })),
  };

  try {
    const bytes = await renderAuditTrailPdf(doc);
    const filename = `audit-trail-${doc.header.caseId}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'pdf_generation_failed', detail: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
