// @polsia:user-owned — pure derived views for the "adoption & realised
// value" measurement dashboard (Section 9 of the Aug 2026 enterprise-
// platform handoff doc). Sibling to telemetry-service.ts, same convention:
// no DB here, called from service.ts's getAdoptionMetrics with real rows.
// Deliberately covers only the dimensions the existing telemetry page
// doesn't already — gate-level approve/return/refuse rates and AI-vs-human
// share already exist in telemetry-service.ts's gateDecisionCounts /
// adminOverview and aren't duplicated here.
//
// Every number here is a real aggregate over real Mission/Approval/
// Objection rows — there is no seeded or invented sample data anywhere in
// this file. On a pilot with few real missions, these numbers will
// legitimately be small; that's what an honest dashboard looks like before
// real usage accumulates, not a reason to fake larger ones.

import type { MissionStatus } from '@/lib/contracts/forge';
// TERMINAL_STATUSES comes from state-machine.ts — the canonical definition,
// not a hand-duplicated copy. This file previously kept its own list that
// included 'RolledBack' as terminal; state-machine.ts deliberately excludes
// it because RolledBack has real forward transitions back to active stages
// (see ALLOWED_TRANSITIONS there), so a rolled-back-but-resumable mission
// was being counted the same as a permanently Rejected/WalkedAway one in
// this file's completionRate calculation.
import { TERMINAL_STATUSES } from './state-machine';

export interface AdoptionMissionRow {
  status: MissionStatus;
  createdAt: string; // ISO
  completedAt: string | null; // ISO
}

export interface StatusBreakdown {
  status: MissionStatus;
  count: number;
}

export interface WeeklyMissionCount {
  weekStartIso: string; // Monday, UTC, YYYY-MM-DD
  count: number;
}

export interface AdoptionMetrics {
  totalMissions: number;
  statusBreakdown: StatusBreakdown[];
  // Of missions that have reached a terminal state, what fraction reached
  // Completed — null (not 0) when no mission has terminated yet, so a new
  // pilot with zero completions reads as "no data" rather than "0% success".
  completionRate: number | null;
  terminalMissionCount: number;
  // Average days from Mission.createdAt to Mission.completedAt, over
  // Completed missions only. Null when there are none yet.
  averageCycleTimeDays: number | null;
  missionsByWeek: WeeklyMissionCount[];
}

export interface AdoptionObjectionRow {
  resolution: string | null;
}

export interface QualityMetrics {
  totalObjections: number;
  resolvedCount: number;
  unresolvedCount: number;
  // null when there are no objections at all — an empty denominator has no
  // honest rate.
  resolutionRate: number | null;
}

function isoWeekStartUtc(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday),
  );
  return monday.toISOString().slice(0, 10);
}

export function computeAdoptionMetrics(missions: readonly AdoptionMissionRow[]): AdoptionMetrics {
  const byStatus = new Map<MissionStatus, number>();
  for (const m of missions) {
    byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
  }
  const statusBreakdown: StatusBreakdown[] = Array.from(byStatus.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const terminal = missions.filter((m) => TERMINAL_STATUSES.has(m.status));
  const completedTerminal = terminal.filter((m) => m.status === 'Completed');
  const completionRate = terminal.length > 0 ? completedTerminal.length / terminal.length : null;

  const completedWithDates = missions.filter(
    (m): m is AdoptionMissionRow & { completedAt: string } =>
      m.status === 'Completed' && m.completedAt !== null,
  );
  const averageCycleTimeDays =
    completedWithDates.length > 0
      ? completedWithDates.reduce((sum, m) => {
          const days =
            (new Date(m.completedAt).getTime() - new Date(m.createdAt).getTime()) /
            (24 * 60 * 60 * 1000);
          return sum + Math.max(0, days);
        }, 0) / completedWithDates.length
      : null;

  const weekMap = new Map<string, number>();
  for (const m of missions) {
    const week = isoWeekStartUtc(m.createdAt);
    weekMap.set(week, (weekMap.get(week) ?? 0) + 1);
  }
  const missionsByWeek: WeeklyMissionCount[] = Array.from(weekMap.entries())
    .map(([weekStartIso, count]) => ({ weekStartIso, count }))
    .sort((a, b) => (a.weekStartIso < b.weekStartIso ? -1 : 1));

  return {
    totalMissions: missions.length,
    statusBreakdown,
    completionRate,
    terminalMissionCount: terminal.length,
    averageCycleTimeDays,
    missionsByWeek,
  };
}

export function computeQualityMetrics(objections: readonly AdoptionObjectionRow[]): QualityMetrics {
  const resolvedCount = objections.filter((o) => o.resolution !== null).length;
  const unresolvedCount = objections.length - resolvedCount;
  return {
    totalObjections: objections.length,
    resolvedCount,
    unresolvedCount,
    resolutionRate: objections.length > 0 ? resolvedCount / objections.length : null,
  };
}
