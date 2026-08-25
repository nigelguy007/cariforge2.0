// @polsia:user-owned — POST /api/newsletter. The blog-waitlist write path:
// captures a single work email into the existing Lead table tagged
// `source = 'newsletter'` so the admin leads view (and CSV export) keep these
// distinct from front-door briefs and procurement walkthroughs. Persists the
// lead FIRST (mandatory), then fires the best-effort owner-email notification
// via the email module's sendEmail helper. The lead persists even if the send
// fails; the response's `notified` flag lets the UI show different copy.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { NewsletterAck, NewsletterSignup } from '@/lib/contracts/newsletter';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { formatNewsletterEmail } from '@/lib/email-templates/newsletter-owner-notification';

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
    const parsed = NewsletterSignup.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
    }
    const lead = await prisma.lead.create({
      data: {
        brief: '(newsletter signup)',
        email: parsed.data.email,
        source: 'newsletter',
      },
    });

    let notified = false;
    const ownerEmail = ownerEmailAddress();
    if (ownerEmail) {
      try {
        const content = formatNewsletterEmail({
          leadId: lead.id,
          capturedAtIso: lead.createdAt.toISOString(),
          email: parsed.data.email,
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
      NewsletterAck.parse({
        email: parsed.data.email,
        id: lead.id,
        createdAt: lead.createdAt.toISOString(),
        notified,
      }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
