// @polsia:user-owned — Static cost lookup + per-record attribution helpers.
// All costs are integer cents. Unknown model = { cents: 0, unknownCost: true }.
// No inference — when the model is missing from COST_TABLE the UI surfaces an
// HONEST unknown marker rather than a fabricated estimate. Pure (no DB).

export type ReleaseActorValue = 'AIOnly' | 'Human' | 'Hybrid';

// Per-model cost lookup. Keyed by lowercased bare model id (the caller
// normalises). Prices are integer cents per million tokens (in/out) and per
// chat message. Keep this small and explicit — unknown keys return
// { cents: 0, unknownCost: true } so the UI shows a HONEST badge.
interface CostEntry {
  readonly inPerMillionCents: number;
  readonly outPerMillionCents: number;
  readonly chatMsgsPerCent: number;
}

export const COST_TABLE: Readonly<Record<string, CostEntry>> = {
  // Anthropic Claude family used by the CARI Forge council + operator agents.
  'claude-opus-4-7': { inPerMillionCents: 1500, outPerMillionCents: 7500, chatMsgsPerCent: 5 },
  'claude-sonnet-4-6': { inPerMillionCents: 300, outPerMillionCents: 1500, chatMsgsPerCent: 2 },
  'claude-haiku-4-5-20251001': {
    inPerMillionCents: 80,
    outPerMillionCents: 400,
    chatMsgsPerCent: 1,
  },
  // OpenAI proxy fallback (utility-class models).
  'gpt-4o': { inPerMillionCents: 250, outPerMillionCents: 1000, chatMsgsPerCent: 2 },
  'gpt-4o-mini': { inPerMillionCents: 15, outPerMillionCents: 60, chatMsgsPerCent: 1 },
};

function lookup(model: string): CostEntry | null {
  const key = model.trim().toLowerCase();
  if (!key) return null;
  return COST_TABLE[key] ?? null;
}

export interface CostResult {
  readonly cents: number;
  readonly unknownCost: boolean;
}

function roundFromMillionCents(tokens: number, perMillionCents: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  // token-millions * cents; round to nearest cent.
  return Math.round((tokens * perMillionCents) / 1_000_000);
}

export function modelUsageCostCents(
  model: string,
  promptTokens: number,
  completionTokens: number,
): CostResult {
  const entry = lookup(model);
  if (!entry) {
    return { cents: 0, unknownCost: true };
  }
  const inCost = roundFromMillionCents(promptTokens, entry.inPerMillionCents);
  const outCost = roundFromMillionCents(completionTokens, entry.outPerMillionCents);
  return { cents: inCost + outCost, unknownCost: false };
}

export function chatCostCents(model: string, messageCount: number): CostResult {
  const entry = lookup(model);
  if (!entry) {
    return { cents: 0, unknownCost: true };
  }
  if (!Number.isFinite(messageCount) || messageCount <= 0) {
    return { cents: 0, unknownCost: false };
  }
  return { cents: messageCount * entry.chatMsgsPerCent, unknownCost: false };
}

export interface BlendedInput {
  readonly missionId: string;
  readonly modelRows: ReadonlyArray<{
    model: string;
    promptTokens: number;
    completionTokens: number;
  }>;
  readonly chatRows: ReadonlyArray<{ model: string; messageCount: number }>;
}

export interface BlendedResult {
  readonly missionId: string;
  readonly modelCents: number;
  readonly chatCents: number;
  readonly blendedCents: number;
  readonly hasUnknownCost: boolean;
}

export function blendedCostCents(input: BlendedInput): BlendedResult {
  let modelCents = 0;
  let chatCents = 0;
  let hasUnknownCost = false;
  for (const row of input.modelRows) {
    const r = modelUsageCostCents(row.model, row.promptTokens, row.completionTokens);
    modelCents += r.cents;
    if (r.unknownCost) hasUnknownCost = true;
  }
  for (const row of input.chatRows) {
    const r = chatCostCents(row.model, row.messageCount);
    chatCents += r.cents;
    if (r.unknownCost) hasUnknownCost = true;
  }
  return {
    missionId: input.missionId,
    modelCents,
    chatCents,
    blendedCents: modelCents + chatCents,
    hasUnknownCost,
  };
}

// creditLedgerTotals — signed-sum helper. Pure.
export function creditLedgerTotals(entries: ReadonlyArray<{ amountCents: number }>): {
  credits: number;
  debits: number;
  net: number;
} {
  let credits = 0;
  let debits = 0;
  for (const e of entries) {
    if (e.amountCents > 0) credits += e.amountCents;
    else if (e.amountCents < 0) debits += -e.amountCents;
  }
  return { credits, debits, net: credits - debits };
}
