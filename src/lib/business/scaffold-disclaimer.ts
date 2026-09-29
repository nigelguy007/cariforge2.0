// @polsia:user-owned — single source of truth for the pilot-scope boundaries
// shown at /why-this-is-a-scaffold ("What a 21-day pilot delivers, and what
// it doesn't"), also consumed by the /sample-brief audit-trail PDF footer so
// they stay in sync. Server-only. The export name is kept for import
// stability.

import 'server-only';

export const SCAFFOLD_DISCLAIMER: { headline: string; detail: string }[] = [
  {
    headline: 'No production hosting.',
    detail:
      'CariForge does not host the working prototype. It is handed over as a runnable codebase the client owns and operates. CariForge provides no hosting environment, DNS or certificates for it.',
  },
  {
    headline: 'No uptime SLA.',
    detail:
      'There is no service-level agreement, status page or on-call rotation behind the prototype. The client runs it on their own infrastructure, under their own terms.',
  },
  {
    headline: 'No 24/7 support.',
    detail:
      'Communication runs on working-week hours, with a named human reply window. There is no always-on support desk. Every reply is written by a named person on the case file.',
  },
  {
    headline: 'No liability for downstream deployment.',
    detail:
      'Once the Decision Pack is handed over, the client decides what ships to production and owns how it is operated, certified and maintained. CariForge’s responsibility ends at the hand-off receipt.',
  },
] as const;
