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
import { friendlyLeadReference, LeadCreate, LeadItem } from '@/lib/contracts/leads';
import { WalkthroughAck, WalkthroughCreate } from '@/lib/contracts/walkthrough';
import { prisma } from '@/lib/db';
// 2026-09-04: switched from the framework's src/lib/email/send.ts to the
// user-owned Resend-backed transport — the framework module's target
// (POLSIA_EMAIL_PROXY_URL) is a confirmed-dead https://email-proxy.invalid
// placeholder, never a real endpoint. See send-resend.ts's own header for
// the full story. Identical SendEmailInput/SendEmailResult interface, so
// nothing else in this file needed to change.
import { sendEmail } from '@/lib/email/send-resend';
import { formatBriefOwnerNotificationEmail } from '@/lib/email-templates/brief-owner-notification';
import { formatBriefAckEmail } from '@/lib/email-templates/brief-submitter-ack';
import { formatWalkthroughEmail } from '@/lib/email-templates/walkthrough-owner-notification';
import { siteUrl } from '@/lib/site';

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
        } catch (err) {
          // Not silently swallowed (2026-09-04) — same fix as the home-
          // branch notification below; lead is still captured either way,
          // the operator can re-notify from the leads table, but a failure
          // is now visible in logs instead of vanishing.
          console.error('[leads] walkthrough owner notification email failed to send:', err);
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

    // Best-effort owner notification (2026-09-04: migrated off the ad-hoc
    // raw fetch to https://polsia.com/api/proxy/email/send — that endpoint
    // needed POLSIA_API_KEY, which was never actually set, AND pointed at
    // POLSIA_EMAIL_PROXY_URL, confirmed to be the literal placeholder
    // https://email-proxy.invalid. Now goes through the same sendEmail/
    // Resend transport as everything else in this file, via a proper
    // template instead of a hand-built string. The catch below used to
    // silently swallow every failure with no logging at all — same
    // silent-failure class this session has fixed everywhere else it's
    // been found; fixed the same way here.
    let notified = false;
    const ownerEmail = ownerEmailAddress();
    if (ownerEmail) {
      try {
        await sendEmail({
          to: ownerEmail,
          ...formatBriefOwnerNotificationEmail({
            leadId: lead.id,
            capturedAtIso: lead.createdAt.toISOString(),
            brief: parsed.data.brief,
            submitterEmail: parsed.data.email,
          }),
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { notifiedAt: new Date() },
        });
        notified = true;
      } catch (err) {
        console.error('[leads] owner notification email failed to send:', err);
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

    // SUBMITTER acknowledgement (2026-09-04, explicit user request): closes
    // a real gap — until now, POST /api/leads only ever emailed the SITE
    // OWNER (above); nothing was ever sent back to the person who submitted
    // the brief. The on-screen "A real human will reply — within 48 hours"
    // promise had nothing behind it once the tab closed. Only fires when an
    // email was actually given (it's an optional field — nothing to send
    // to otherwise); best-effort, same resilience pattern as the owner
    // notification above — a failed send never blocks the lead response,
    // the lead is already persisted regardless. Deliberately NOT silently
    // swallowed like the owner-notification catch above: this is a brand
    // new, unverified code path, and this exact codebase has already been
    // bitten once this session by an error that silently swallowed itself
    // into "looks fine, does nothing" (the AI Gateway diagnosis). A failed
    // send here is real signal an operator needs — most likely cause is
    // POLSIA_API_KEY being unset in this deploy's environment, the same gap
    // that already silently no-ops the owner notification above.
    if (parsed.data.email) {
      try {
        const reference = friendlyLeadReference(lead.id);
        await sendEmail({
          to: parsed.data.email,
          ...formatBriefAckEmail({
            brief: parsed.data.brief,
            reference,
            signupUrl: `${siteUrl}/signup`,
            triage: triage.status === 'ok' ? triage.result : undefined,
          }),
        });
      } catch (err) {
        console.error('[leads] submitter acknowledgement email failed to send:', err);
      }
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
