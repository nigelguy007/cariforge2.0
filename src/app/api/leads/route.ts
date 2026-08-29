// @polsia:user-owned — POST /api/leads. The single funnel's write path for
// BOTH the front-door home-page brief intake (source='home', default) and the
// procurement-grade /request-walkthrough form (source='walkthrough'). Persists
// the lead FIRST (mandatory), then best-effort fires the owner-email
// notification via the email module's sendEmail helper. The lead persists
// even if the send fails; the response's `notified` flag lets the UI show
// different copy.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getConfiguratorResult } from '@/lib/business/configurator';
import { LeadCreate, LeadItem } from '@/lib/contracts/leads';
import { WalkthroughAck, WalkthroughCreate } from '@/lib/contracts/walkthrough';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { formatWalkthroughEmail } from '@/lib/email-templates/walkthrough-owner-notification';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

function ownerEmailAddress(): string | undefined {
  return process.env.POLSIA_COMPANY_EMAIL ?? process.env.POLSIA_OWNER_EMAIL;
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as { source?: unknown };
    const source = raw?.source === 'walkthrough' ? 'walkthrough' : 'home';

    if (source === 'walkthrough') {
      const parsed = WalkthroughCreate.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
      }
      const v = parsed.data;
      const lead = await prisma.lead.create({
        data: {
          brief: v.description,
          email: v.workEmail,
          source: 'walkthrough',
          payload: JSON.stringify({
            fullName: v.fullName,
            organisation: v.organisation,
            role: v.role,
            segment: v.segment,
          }),
        },
      });

      let notified = false;
      const ownerEmail = ownerEmailAddress();
      if (ownerEmail) {
        try {
          const content = formatWalkthroughEmail({
            leadId: lead.id,
            capturedAtIso: lead.createdAt.toISOString(),
            payload: v,
          });
          await sendEmail({
            to: ownerEmail,
            subject: content.subject,
            html: content.html,
            ...(content.text ? { text: content.text } : {}),
          });
          await prisma.lead.update({
            where: { id: lead.id },
            data: { notifiedAt: new Date() },
          });
          notified = true;
        } catch {
          // swallow — lead is captured; the operator can re-notify from the leads table.
        }
      }

      return NextResponse.json(
        WalkthroughAck.parse({
          ...v,
          id: lead.id,
          createdAt: lead.createdAt.toISOString(),
          notified,
        }),
        { status: 201 },
      );
    }

    // Front-door brief path (source='home' or absent).
    const parsed = LeadCreate.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
    }
    const lead = await prisma.lead.create({
      data: {
        brief: parsed.data.brief,
        email: parsed.data.email ?? null,
        source: 'home',
      },
    });

    // Best-effort owner notification via the Polsia email proxy. Skips silently
    // in local dev (no API key); the lead still persists.
    let notified = false;
    const apiKey = process.env.POLSIA_API_KEY;
    const ownerEmail = ownerEmailAddress();
    if (apiKey && ownerEmail) {
      try {
        const subject = `New CARI Forge brief${parsed.data.email ? ` — ${parsed.data.email}` : ''}`;
        const body = [
          'A regulated buyer just left a one-line brief on cariforge.com.',
          '',
          `Captured: ${lead.createdAt.toISOString()}`,
          `Lead id:   ${lead.id}`,
          `Email:      ${parsed.data.email ?? '(none)'}`,
          '',
          '--- brief ---',
          parsed.data.brief,
          '',
          'See the leads table for the full record.',
        ].join('\n');
        const res = await fetch('https://polsia.com/api/proxy/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ to: ownerEmail, subject, body }),
        });
        if (res.ok) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { notifiedAt: new Date() },
          });
          notified = true;
        }
      } catch {
        // swallow — lead is captured; the operator can re-notify from the leads table.
      }
    }

    // Product decision (2026-08-29): the front-door brief's first response
    // is a fully-automated Discovery-agent read — no human in the loop
    // before the visitor sees it. Reuses the exact call already live behind
    // the pre-signup workflow configurator (never throws; degrades to
    // {status:'unavailable'} on any failure, which the UI shows as a plain
    // "a named human will follow up" fallback — the brief is captured
    // either way regardless of this call's outcome).
    const triage = await getConfiguratorResult(parsed.data.brief);
    if (triage.status === 'ok') {
      await prisma.lead.update({ where: { id: lead.id }, data: { triage: triage.result } });
    }

    return NextResponse.json(
      LeadItem.parse({
        id: lead.id,
        brief: parsed.data.brief,
        email: parsed.data.email,
        createdAt: lead.createdAt.toISOString(),
        notified,
        triage,
      }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
