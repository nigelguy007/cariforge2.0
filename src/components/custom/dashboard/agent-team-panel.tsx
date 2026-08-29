// @polsia:user-owned — R6 (mission pipeline rebuild): "Your AI team" panel.
// Reference: apps/web/components/AgentTeam/AgentTeam.tsx on the real
// platform's case list — a real role="table" (Agent · Does · Active now ·
// Completed), numbers computed live from the org's own case list, not a
// marketing icon grid. This repo already has the matching roster: the
// seven-agent core model served from GET /api/agents (src/lib/business/agents.ts)
// — same "seven specialists" framing, distinct from The Oracles (the human
// governance council). Agents 1-5 map 1:1 onto the five gate stages; Agents
// 6-7 (Partner, Impact) are wraparound concepts this repo has no mission
// data for yet (confirmed gap — see docs/HANDOVER-MISSION-PIPELINE-REBUILD.md
// R6/section 3), so they're shown with an honest "Not tracked yet" rather
// than a fabricated zero.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import type { CoreAgents } from '@/lib/contracts/agents';
import { CoreAgents as CoreAgentsSchema } from '@/lib/contracts/agents';
import { type MissionListItemT, MissionList as MissionListSchema } from '@/lib/contracts/forge';

// Mirrors state-machine.ts's TERMINAL_STATUSES for display purposes only —
// a mission in one of these statuses is no longer actively occupying any
// gate, so it shouldn't count toward an agent's "Active now".
const NON_ACTIVE_STATUSES = new Set(['Completed', 'WalkedAway', 'RolledBack', 'Rejected']);

interface AgentRow {
  id: string;
  role: string;
  mandate: string;
  activeNow: number | null;
  completed: number | null;
  // UX review: real user confusion ("what's the difference between the 5
  // agents and 7 specialised agents?") — this table had no visible mapping
  // at all. Mirrors the marketing page's per-card stage pill
  // (core-agents-section.tsx) so the same 5-run-the-gates / 2-wrap-delivery
  // distinction is legible in the authenticated product, not just on /how-it-works.
  stageLabel: string;
}

function computeAgentRows(agents: CoreAgents, missions: MissionListItemT[]): AgentRow[] {
  return agents.items.map((agent) => {
    // relatesToStage uses 'Software Build' (a display string with a space);
    // GATE_DEFS' ordinal-1 agents map onto gate index (ordinal - 1).
    if (agent.scope === 'Wraparound') {
      return {
        id: agent.id,
        role: agent.role,
        mandate: agent.mandate,
        activeNow: null,
        completed: null,
        stageLabel: 'Wraps delivery',
      };
    }
    const gateIndex = agent.ordinal - 1;
    let activeNow = 0;
    let completed = 0;
    for (const m of missions) {
      if (m.currentStageIndex > gateIndex) {
        completed += 1;
      } else if (m.currentStageIndex === gateIndex) {
        if (NON_ACTIVE_STATUSES.has(m.status)) completed += 1;
        else activeNow += 1;
      }
    }
    return {
      id: agent.id,
      role: agent.role,
      mandate: agent.mandate,
      activeNow,
      completed,
      stageLabel: `Runs gate ${agent.ordinal} · ${agent.relatesToStage}`,
    };
  });
}

export function AgentTeamPanel() {
  const [agents, setAgents] = React.useState<CoreAgents | null>(null);
  const [missions, setMissions] = React.useState<MissionListItemT[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/api/agents', { schema: CoreAgentsSchema }),
      apiFetch('/api/forge/missions', { schema: MissionListSchema }),
    ])
      .then(([agentsData, missionsData]) => {
        if (cancelled) return;
        setAgents(agentsData);
        setMissions(missionsData.items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load the AI team: {error}</p>
      </div>
    );
  }
  if (!agents || !missions) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading your AI team…</p>
      </div>
    );
  }

  const rows = computeAgentRows(agents, missions);

  return (
    <div className="glass-card rounded-2xl p-6">
      {/* Real mobile bug found via user screenshot: a 560px-min table inside
          overflow-x-auto is technically scrollable, but a rounded-2xl card
          with no scroll hint reads as broken — the row just gets cut off at
          the screen edge with no affordance to swipe. Below md: this data
          renders as stacked cards instead (each field is a labeled row, so
          nothing needs a wide table to stay legible); the real table comes
          back at md: and up where 560px comfortably fits. */}
      <table className="hidden w-full text-left text-body md:table">
        <thead>
          <tr className="border-b border-border/60 text-caption uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">
              Agent
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Does
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Active now
            </th>
            <th scope="col" className="py-2 font-medium">
              Completed
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/40 last:border-0">
              <td className="py-3 pr-4 align-top">
                <p className="font-medium text-foreground">{row.role}</p>
                <span className="glass-chip mt-1 inline-block rounded-full px-2 py-0.5 text-caption">
                  {row.stageLabel}
                </span>
              </td>
              <td className="max-w-md py-3 pr-4 align-top text-small text-muted-foreground">
                {row.mandate}
              </td>
              <td className="py-3 pr-4 align-top text-h4">
                {row.activeNow === null ? (
                  <span className="text-small text-muted-foreground">Not tracked yet</span>
                ) : (
                  row.activeNow
                )}
              </td>
              <td className="py-3 align-top text-h4">
                {row.completed === null ? (
                  <span className="text-small text-muted-foreground">Not tracked yet</span>
                ) : (
                  row.completed
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col divide-y divide-border/40 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{row.role}</p>
              <span className="glass-chip rounded-full px-2 py-0.5 text-caption">
                {row.stageLabel}
              </span>
            </div>
            <p className="mt-1 text-small text-muted-foreground">{row.mandate}</p>
            <div className="mt-3 flex gap-6">
              <div>
                <p className="text-caption uppercase tracking-wide text-muted-foreground">
                  Active now
                </p>
                <p className="mt-0.5 text-h4 text-foreground">
                  {row.activeNow === null ? (
                    <span className="text-small text-muted-foreground">Not tracked yet</span>
                  ) : (
                    row.activeNow
                  )}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-wide text-muted-foreground">
                  Completed
                </p>
                <p className="mt-0.5 text-h4 text-foreground">
                  {row.completed === null ? (
                    <span className="text-small text-muted-foreground">Not tracked yet</span>
                  ) : (
                    row.completed
                  )}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
