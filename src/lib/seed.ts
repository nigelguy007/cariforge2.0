// @polsia:user-owned — deploy-time database seed. You OWN this file.
//
// seed() runs once when the server boots (via the framework-owned
// src/instrumentation.ts), on the Node server, AFTER the schema is applied.
// Every write here is IDEMPOTENT (upsert), per the framework's rules: it
// may run on every deploy/boot, possibly concurrently on more than one
// instance.
//
// Seeds the Forge Canvas agent registry (Agent Builder Release 1: "Agent
// registry with five initial agent templates"). Three Forge Crew agents
// (mirroring the existing seven-agent core's Discovery/Readiness/
// Governance mandates) plus two operational templates, so the canvas has
// both governance-flavoured and business-flavoured agents to compose.

export async function seed(): Promise<void> {
  const { prisma } = await import('@/lib/db');

  const templates = [
    {
      slug: 'forge-discovery',
      name: 'Discovery Agent',
      category: 'forge-crew',
      riskClass: 'low',
      description:
        'Translates an inbound need into a testable problem statement with named must-not-happen clauses.',
    },
    {
      slug: 'forge-readiness',
      name: 'Readiness Agent',
      category: 'forge-crew',
      riskClass: 'medium',
      description:
        'Audits data sources, integrations and the regulatory regime before code; drafts the build-versus-buy comparison.',
    },
    {
      slug: 'forge-governance',
      name: 'Governance Agent',
      category: 'forge-crew',
      riskClass: 'high',
      description:
        'Checks that logging, oversight and stop-the-line controls hold; flags policy gaps before approval.',
    },
    {
      slug: 'ops-customer-triage',
      name: 'Customer Triage Agent',
      category: 'customer-service',
      riskClass: 'low',
      description:
        'Reads an inbound customer message, classifies intent and urgency, and drafts a routing recommendation.',
    },
    {
      slug: 'ops-invoice-extraction',
      name: 'Invoice Extraction Agent',
      category: 'finance',
      riskClass: 'medium',
      description:
        'Extracts structured fields (supplier, amount, dates, line items) from an invoice document for review.',
    },
  ] as const;

  for (const t of templates) {
    await prisma.canvasAgentDefinition.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        category: t.category,
        riskClass: t.riskClass,
        description: t.description,
        config: { role: t.name, instructions: t.description },
        status: 'Published',
      },
      // Keep description/name current on redeploy; never touch user data.
      update: { name: t.name, description: t.description, category: t.category },
    });
  }
}
