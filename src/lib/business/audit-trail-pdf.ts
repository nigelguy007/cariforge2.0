// @polsia:user-owned — server-only renderer for the /sample-brief audit-trail
// PDF. Lays out a single A4 page with the worked-example mission from top to
// bottom: title block (caseId + submitted/closed dates), §01 buyer brief with
// the must-not-happen guard-rails, §02 council debate (5 advisor rows in a
// compact single column), §03 chair's reconciled ruling (first 2 sentences),
// §04 supervisor sign-off (5 named approvers + typed reason), and a §05
// footnote disclaimer (5 notCovered bullets). Pure pdf-lib — no headless
// browser, no network call.

import 'server-only';

import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { AuditTrailDocument } from '@/lib/contracts/audit-trail-document';

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const TEXT = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.82, 0.84, 0.88);
const BRAND = rgb(0.18, 0.22, 0.55);

// pdf-lib's bundled StandardFonts are WinAnsi-encoded. Strip non-ASCII glyphs
// that can't be drawn so a stray apostrophe / em-dash never throws mid-render.
// Plain ASCII keeps the document readable on every system without font
// embedding gymnastics.
function sanitize(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[^\x20-\x7E]/g, '');
}

function widthOf(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(sanitize(text), size);
}

// Greedy word-wrap to lines that fit `maxWidth`.
function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(font, candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncateSentences(text: string, sentences: number): string {
  const clean = sanitize(text);
  const parts = clean.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [clean];
  return parts.slice(0, sentences).join(' ').trim();
}

interface Cursor {
  y: number;
  page: PDFPage;
}

export async function renderAuditTrailPdf(input: AuditTrailDocument): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier); // monospace — case IDs and timestamps read cleanly
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cursor: Cursor = { page, y: PAGE_HEIGHT - MARGIN_TOP };

  const drawText = (
    text: string,
    opts: { x?: number; size?: number; font?: PDFFont; color?: typeof TEXT; rightX?: number } = {},
  ) => {
    const f = opts.font ?? bodyFont;
    const size = opts.size ?? 9;
    const clean = sanitize(text);
    if (!clean) return;
    const x =
      opts.rightX !== undefined
        ? MARGIN_X + opts.rightX - widthOf(f, clean, size)
        : MARGIN_X + (opts.x ?? 0);
    cursor.page.drawText(clean, { x, y: cursor.y, size, font: f, color: opts.color ?? TEXT });
  };

  const drawWrapped = (
    text: string,
    size: number,
    maxWidth: number,
    opts: { font?: PDFFont; color?: typeof TEXT; leading?: number } = {},
  ) => {
    const f = opts.font ?? bodyFont;
    const leading = opts.leading ?? size * 1.35;
    const lines = wrap(f, text, size, maxWidth);
    for (const line of lines) {
      cursor.y -= leading;
      if (cursor.y < MARGIN_BOTTOM) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursor.page = page;
        cursor.y = PAGE_HEIGHT - MARGIN_TOP;
      }
      drawText(line, { size, font: f, color: opts.color ?? TEXT });
    }
  };

  const drawRule = () => {
    cursor.y -= 4;
    page.drawLine({
      start: { x: MARGIN_X, y: cursor.y },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: cursor.y },
      thickness: 0.5,
      color: RULE,
    });
    cursor.y -= 6;
  };

  const drawHeading = (section: string, title: string) => {
    cursor.y -= 6;
    if (cursor.y < MARGIN_BOTTOM + 40) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.page = page;
      cursor.y = PAGE_HEIGHT - MARGIN_TOP;
    }
    drawText(section, { size: 7, font: bold, color: BRAND });
    cursor.y -= 10;
    drawText(title, { size: 11, font: bold });
    cursor.y -= 4;
  };

  // --- Title block ---
  drawText('AUDIT TRAIL', { size: 7, font: bold, color: BRAND });
  drawText(input.header.buyerOrg, { size: 14, font: bold });

  cursor.y -= 16;
  drawText(`Case ID: ${input.header.caseId}`, { size: 9, font, color: TEXT });
  drawText(`Submitted ${input.header.submittedOn}  |  Closed ${input.header.closedOn}`, {
    size: 8,
    font,
    color: MUTED,
    rightX: CONTENT_WIDTH,
  });
  cursor.y -= 12;
  drawText(`Reviewer: ${input.header.reviewer}`, { size: 8, color: MUTED });

  drawRule();

  // --- §01 Brief ---
  drawHeading('SECTION 01  -  THE BRIEF AS SUBMITTED', 'Buyer brief');
  drawText(input.brief.industry, { size: 8, color: MUTED });
  cursor.y -= 8;

  drawWrapped(
    `Problem statement: ${truncateSentences(input.brief.problemStatement, 1)}`,
    9,
    CONTENT_WIDTH,
  );
  cursor.y -= 4;
  drawWrapped(
    `Proposed approach: ${truncateSentences(input.brief.proposedApproach, 1)}`,
    9,
    CONTENT_WIDTH,
  );

  cursor.y -= 4;
  drawText('Must not happen:', { size: 9, font: bold });
  for (const clause of input.brief.mustNotHappen) {
    cursor.y -= 12;
    drawWrapped(`  - ${truncateSentences(clause, 1)}`, 8, CONTENT_WIDTH, { color: TEXT });
  }

  drawRule();

  // --- §02 Council ---
  drawHeading('SECTION 02  -  THE FIVE ADVISORS', 'Council debate');
  for (const advisor of input.council) {
    cursor.y -= 2;
    drawText(`${advisor.role.toUpperCase()} [${advisor.stance}]`, {
      size: 9,
      font: bold,
      color: BRAND,
    });
    drawWrapped(advisor.objection, 8, CONTENT_WIDTH, { color: TEXT });
    cursor.y -= 2;
  }

  drawRule();

  // --- §03 Ruling ---
  drawHeading("SECTION 03  -  THE ELDER ORACLE'S RULING", `${input.ruling.verdict}`);
  drawWrapped(truncateSentences(input.ruling.reconciliation, 2), 9, CONTENT_WIDTH);
  if (input.ruling.carriedDissent.length > 0) {
    cursor.y -= 4;
    drawText('Carry-forward (no silent drop):', { size: 8, font: bold });
    for (const d of input.ruling.carriedDissent) {
      cursor.y -= 11;
      drawWrapped(`  - ${truncateSentences(d, 2)}`, 8, CONTENT_WIDTH, { color: MUTED });
    }
  }

  drawRule();

  // --- §04 Signatures ---
  drawHeading('SECTION 04  -  SUPERVISOR SIGN-OFF', 'Named human approver at every gate');
  for (const sig of input.signatures) {
    cursor.y -= 2;
    drawText(
      `Agent ${sig.agentOrdinal} - ${sig.agentName}  ::  ${sig.name} (${sig.role})  ::  ${sig.decision.toUpperCase()}`,
      { size: 8, font: bold },
    );
    cursor.y -= 11;
    drawWrapped(`"${truncateSentences(sig.typedReason, 2)}"`, 8, CONTENT_WIDTH, {
      color: TEXT,
    });
    if (sig.elderOracleMatched) {
      cursor.y -= 11;
      drawWrapped(
        'ELDER ORACLE ATTESTATION: signed by the appointed Elder Oracle.',
        7,
        CONTENT_WIDTH,
        {
          color: BRAND,
        },
      );
    }
    drawText(`signed ${sig.signedAt}`, { size: 7, font, color: MUTED, rightX: CONTENT_WIDTH });
    cursor.y -= 4;
  }

  drawRule();

  // --- §05 Disclaimer ---
  drawHeading(
    'SECTION 05  -  WHAT THIS DELIVERABLE DOES NOT COVER',
    'Scaffold disclaimer (identical to /why-this-is-a-scaffold)',
  );
  for (const row of input.disclaimer) {
    cursor.y -= 2;
    drawText(`- ${row.headline}`, { size: 8, font: bold });
    cursor.y -= 10;
    drawWrapped(row.detail, 7, CONTENT_WIDTH, { color: MUTED });
  }

  // --- Footer ---
  cursor.y = MARGIN_BOTTOM - 6;
  page.drawLine({
    start: { x: MARGIN_X, y: cursor.y + 4 },
    end: { x: MARGIN_X + CONTENT_WIDTH, y: cursor.y + 4 },
    thickness: 0.5,
    color: RULE,
  });
  drawText(
    `CARI Forge audit trail  |  ${input.header.caseId}  |  rendered ${new Date().toISOString().slice(0, 10)}`,
    { size: 7, color: MUTED },
  );

  return doc.save();
}
