// @polsia:user-owned — single source of truth for the /why-this-is-a-scaffold
// footnote disclaimer (also consumed by the /sample-brief audit-trail PDF
// footer so they stay in sync). Server-only.

import 'server-only';

export const SCAFFOLD_DISCLAIMER: { headline: string; detail: string }[] = [
  {
    headline: 'No production hosting.',
    detail:
      'CARI Forge does not host the Software Build. The hand-off is a runnable codebase, not a running system — there is no provisioned environment, no DNS, no certificate behind this site for what we deliver.',
  },
  {
    headline: 'No uptime SLA.',
    detail:
      'There is no service-level agreement, no status page, and no on-call rotation behind the deliverable. The Software Build exists for the buyer to operate on their own infrastructure under their own terms.',
  },
  {
    headline: 'No 24/7 support.',
    detail:
      'Communication runs on working-week hours, with a named human reply window. There is no always-on support desk and no tier-one triage queue — every reply is written by a named human on the case file.',
  },
  {
    headline: 'No automated customer-facing login.',
    detail:
      'The way in is a one-line brief through a human-gated intake form, not a self-serve sign-up or a public sign-in flow. There is no API key issuance, no end-user account system, no public authentication surface created by the build.',
  },
  {
    headline: 'No liability for downstream deployment.',
    detail:
      'Once the Software Build is received, what ships to production — and how it is operated, certified, and maintained — is the buyer’s responsibility to decide and own. CARI Forge’s responsibility ends at the Software Build receipt.',
  },
] as const;
