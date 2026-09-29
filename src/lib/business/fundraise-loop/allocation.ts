// @polsia:user-owned — the fundraise loop's re-aiming engine. Pure and
// deterministic (seeded RNG) so every behaviour is unit-tested.
//
// Design notes (why this is not "lean toward whoever replied"):
//  - success = meeting-or-better; a reply alone is a 0.25 pseudo-success.
//  - a silent contact only counts as a trial once older than the segment's
//    lagDays, so slow allocators (DFIs, pensions) are not punished for being
//    slow.
//  - every ACTIVE segment keeps a floor share until it has
//    minTrialsBeforeCut matured trials; after that an exploration floor —
//    never zero. Only a human pause removes a segment.
//  - per-segment weekly cap = remaining / minWeeksRunway, so the loop can't
//    burn a small market in a few weeks.

export const MEETING_OR_BETTER = new Set(['MEETING', 'SECOND_MEETING', 'TERM_SHEET']);
export const REPLY_PSEUDO_SUCCESS = 0.25;
const DRAWS = 2000;

export type LoopConfigInput = {
  batchSize: number;
  minSegmentShare: number;
  explorationFloor: number;
  minTrialsBeforeCut: number;
  minWeeksRunway: number;
};

export type SegmentInput = {
  key: string;
  status: 'ACTIVE' | 'PAUSED';
  estUniverse: number;
  lagDays: number;
  /** Prospects ever delivered to this segment (any status except SKIPPED). */
  contacted: number;
  sent: Array<{ sentAt: Date; events: string[] }>;
};

export type SegmentResult = {
  key: string;
  contacted: number;
  maturedTrials: number;
  replies: number;
  meetings: number;
  successes: number;
  posteriorMean: number;
  probBest: number;
  allocation: number;
  burnPct: number;
  weeksOfMarketLeft: number | null;
  recommendation: 'insufficient-data' | 'keep' | 'lean-in' | 'consider-pausing' | 'exhausted';
};

/** mulberry32 — small, fast, seedable PRNG. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(r: () => number) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Marsaglia–Tsang gamma sampler (shape ≥ 1 path + boost for shape < 1). */
function gamma(shape: number, r: () => number): number {
  if (shape < 1) return gamma(shape + 1, r) * r() ** (1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = gaussian(r);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function betaSample(a: number, b: number, r: () => number) {
  const x = gamma(a, r);
  const y = gamma(b, r);
  return x / (x + y);
}

export function segmentEvidence(seg: SegmentInput, now: Date) {
  const lagMs = seg.lagDays * 86_400_000;
  let matured = 0;
  let replies = 0;
  let meetings = 0;
  let successes = 0;
  for (const s of seg.sent) {
    const hasMeeting = s.events.some((e) => MEETING_OR_BETTER.has(e));
    const hasReply = s.events.includes('REPLY');
    const hasAnyOutcome = s.events.length > 0;
    if (hasReply || hasMeeting) replies++;
    if (hasMeeting) meetings++;
    // A contact is a trial once it has an outcome or has aged past the lag.
    if (hasAnyOutcome || now.getTime() - s.sentAt.getTime() >= lagMs) {
      matured++;
      if (hasMeeting) successes += 1;
      else if (hasReply) successes += REPLY_PSEUDO_SUCCESS;
    }
  }
  return { matured, replies, meetings, successes };
}

/** Record lookup that is total under noUncheckedIndexedAccess (missing → 0). */
const at = (r: Record<string, number>, k: string) => r[k] ?? 0;

/**
 * Largest-remainder rounding of fractional targets, respecting per-key caps.
 *
 * Loops until the total is placed or no key can take more: capacity freed by
 * capped keys is redistributed pass after pass, however deep the cascade.
 * Keys with a positive target are always served first; only when every one
 * of them is capped does the leftover spill evenly onto open keys whose
 * target is 0. Invariant: Σout = min(total, Σcaps).
 */
export function apportion(
  targets: Record<string, number>,
  caps: Record<string, number>,
  total: number,
) {
  const keys = Object.keys(targets);
  const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  let remaining = Math.max(0, Math.floor(total));
  while (remaining > 0) {
    const open = keys.filter((k) => at(out, k) < at(caps, k));
    if (open.length === 0) break;
    const positive = open.filter((k) => at(targets, k) > 0);
    // Positive-target keys first; zero-target keys only once those are all capped.
    const pool = positive.length > 0 ? positive : open;
    const weight = pool.reduce((s, k) => s + Math.max(0, at(targets, k)), 0);
    const raw = pool.map((k) => {
      const share = weight > 0 ? Math.max(0, at(targets, k)) / weight : 1 / pool.length;
      const want = Math.min(share * remaining, at(caps, k) - at(out, k));
      return { k, want, floor: Math.floor(want) };
    });
    let used = 0;
    for (const x of raw) {
      out[x.k] = at(out, x.k) + x.floor;
      used += x.floor;
    }
    // Hand the rest out one at a time by largest fractional remainder.
    let leftover = remaining - used;
    for (const x of [...raw].sort((p, q) => q.want - q.floor - (p.want - p.floor))) {
      if (leftover <= 0) break;
      if (x.want - x.floor > 1e-9 && at(out, x.k) < at(caps, x.k)) {
        out[x.k] = at(out, x.k) + 1;
        used += 1;
        leftover -= 1;
      }
    }
    if (used === 0) break; // no progress possible (defensive; see invariant)
    remaining -= used;
  }
  return out;
}

export function planAllocation(
  segments: SegmentInput[],
  cfg: LoopConfigInput,
  now: Date = new Date(),
  seed = 42,
): SegmentResult[] {
  const r = rng(seed);
  const ev = segments.map((s) => ({ seg: s, ...segmentEvidence(s, now) }));
  const active = ev.filter((e) => e.seg.status === 'ACTIVE');

  // P(best) by Monte Carlo over Beta posteriors (active segments only).
  const wins: Record<string, number> = Object.fromEntries(active.map((e) => [e.seg.key, 0]));
  const first = active[0];
  if (first) {
    for (let i = 0; i < DRAWS; i++) {
      let bestKey = first.seg.key;
      let bestVal = -1;
      for (const e of active) {
        const v = betaSample(1 + e.successes, 1 + Math.max(0, e.matured - e.successes), r);
        if (v > bestVal) {
          bestVal = v;
          bestKey = e.seg.key;
        }
      }
      wins[bestKey] = at(wins, bestKey) + 1;
    }
  }
  const probBest = (k: string) => (active.length ? at(wins, k) / DRAWS : 0);
  const mean = (e: (typeof ev)[number]) => (1 + e.successes) / (2 + e.matured);

  const remaining = (s: SegmentInput) => Math.max(0, s.estUniverse - s.contacted);
  const floorFor = (e: (typeof ev)[number]) =>
    e.matured >= cfg.minTrialsBeforeCut ? cfg.explorationFloor : cfg.minSegmentShare;

  const floors = active.map(floorFor);
  const floorSum = floors.reduce((a, b) => a + b, 0);
  const scale = floorSum > 1 ? 1 / floorSum : 1; // too many floors → normalise
  const free = Math.max(0, 1 - floorSum * scale);
  const targets: Record<string, number> = {};
  const caps: Record<string, number> = {};
  active.forEach((e, i) => {
    targets[e.seg.key] = (floors[i] ?? 0) * scale + free * probBest(e.seg.key);
    const rem = remaining(e.seg);
    caps[e.seg.key] = Math.min(
      rem,
      Math.max(rem > 0 ? 1 : 0, Math.floor(rem / cfg.minWeeksRunway)),
    );
  });
  const alloc = apportion(targets, caps, cfg.batchSize);

  const leaderMean = Math.max(0, ...active.map(mean));
  return ev.map((e) => {
    const rem = remaining(e.seg);
    const a = alloc[e.seg.key] ?? 0;
    const pb = e.seg.status === 'ACTIVE' ? probBest(e.seg.key) : 0;
    let rec: SegmentResult['recommendation'];
    if (rem === 0) rec = 'exhausted';
    else if (e.matured < cfg.minTrialsBeforeCut) rec = 'insufficient-data';
    else if (pb < 0.05 && mean(e) < leaderMean / 2) rec = 'consider-pausing';
    else if (pb >= 0.5) rec = 'lean-in';
    else rec = 'keep';
    return {
      key: e.seg.key,
      contacted: e.seg.contacted,
      maturedTrials: e.matured,
      replies: e.replies,
      meetings: e.meetings,
      successes: e.successes,
      posteriorMean: mean(e),
      probBest: pb,
      allocation: a,
      burnPct: e.seg.estUniverse > 0 ? Math.min(1, e.seg.contacted / e.seg.estUniverse) : 1,
      weeksOfMarketLeft: a > 0 ? Math.floor(rem / a) : null,
      recommendation: rec,
    };
  });
}
