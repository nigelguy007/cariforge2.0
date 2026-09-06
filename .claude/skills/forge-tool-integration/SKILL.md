---
name: forge-tool-integration
description: "Recipe for wiring a REAL external tool or MCP server into CariForge's governed ToolAction pipeline, so an agent's work actually reaches a real system instead of just being recorded. Use when the user asks to 'add an integration', 'connect X system', 'let the agent actually do Y', or 'wire up MCP/a tool' for a CariForge project. Covers: the existing ToolAction data model and approval gate, where real execution code goes today (nowhere — it's a manual stub), the exact steps to replace that stub with a real call, and the governance/audit conventions already established in this codebase (Internal vs External scope, requiresGateApproval, writeAudit). Does not cover SSO, KMS, or compliance certification (SOC-2/GDPR/FedRAMP) — those are a different kind of gap."
---

# CariForge Tool Integration

How to connect a CariForge project's agents to a **real** external system (an
API, an MCP server, a webhook) instead of the governance-only stub that
exists today. Written 2026-09-05 after finding, by reading the code, that
CariForge's `ToolAction` model is a complete governance ledger with **zero
real execution behind it** — this skill is how to close that gap for one
specific, chosen system at a time. It never invents which system to wire up;
that's a business decision, always confirmed with the user first.

## What already exists (read this before touching anything)

- **Data model**: `ToolAction` — `tool` (a name string), `scope` (`Internal`
  | `External`), `payload` (arbitrary JSON the agent proposed), `decision`
  (`Approved` | `Denied` | null), `executedAt`, `resultRef`. See
  `src/lib/contracts/forge.ts`'s `ToolActionCreate`/`ToolActionItem`.
- **Governance layer** (`src/lib/business/forge/tool-actions.ts`, pure, no
  DB): `assertScopeDenied` (blocks all tool actions while the mission is
  Paused/Blocked/Rejected/WalkedAway/RolledBack), `assertExternalApproved`
  (External scope MUST have `requiresGateApproval: true` and an Approve
  decision on record before it can run), `assertRollbackLink` (a rollback
  must target a real, already-executed prior action).
- **Write paths** (`src/lib/business/forge/service.ts` — grep for
  `ToolAction` — and the routes under
  `src/app/api/forge/missions/[id]/tool-actions/`): `propose` → `decide` →
  `execute` → optional `rollback`. Every step writes a `missionAudit` row
  (`writeAudit`) — this is the same audit trail every other governance
  action in this app uses; don't invent a parallel logging path.
- **The gap**: `execute/route.ts` calls `executeToolAction`, which accepts an
  optional `resultRef: string` **the caller supplies by hand** and just
  stamps `executedAt`. Nothing in this codebase ever calls a real API, MCP
  server, or webhook. A person (or an agent) doing the work happens
  entirely outside CariForge today; CariForge only records that it
  happened.

## Before writing any code

1. **Confirm the target system with the user.** Never guess. Ask: which
   system, what should the agent be able to do there (read-only? create
   records? send messages?), and do they have — or can they create — real
   credentials for it (an API key, an MCP server URL, OAuth app).
2. **Confirm Internal vs External scope.** `Internal` = affects only data
   inside CariForge's own governed record (e.g., generating a document
   CariForge stores itself). `External` = reaches outside CariForge (an
   email, a Slack message, writing to the customer's own system) — this
   MUST be `requiresGateApproval: true` per `assertExternalApproved`, no
   exceptions. If you're unsure which one a proposed integration is, it's
   almost always `External`.
3. **Never hardcode a provider SDK or fake a mock as a co-equal default.**
   If a first-party marketplace/integration flow is available in this
   environment for the chosen provider, prefer it for provisioning the
   actual credentials over rolling your own env-var wiring by hand.

## The recipe

1. **Add real credentials** the same way every existing AI-backed
   business-logic file in this repo does — `process.env.<PROVIDER>_...`,
   read once in a small `getClient()`-style helper, never inlined at the
   call site. Mirror `src/lib/business/forge/ai-draft.ts`'s `getClient()`
   pattern: return `null` when the key is absent, and let the caller
   degrade gracefully rather than throw.
2. **Write the real call as its own small module** under
   `src/lib/business/forge/` (e.g. `tool-execute-<name>.ts`), exporting one
   function that takes the `ToolAction`'s `payload` and returns
   `{status: 'ok', resultRef: string} | {status: 'unavailable', reason: string}`.
   Match this codebase's established timeout/retry convention for any
   outbound network call: an explicit timeout (don't rely on library
   defaults — see `ai-draft.ts`'s header comment for why the Anthropic
   SDK's defaults once caused a real 300s platform-kill), and never let an
   external outage throw past a governed decision point.
3. **Call it from `executeToolAction`** (`service.ts`) instead of trusting
   a caller-supplied `resultRef` — keep accepting a manual `resultRef` as a
   fallback ONLY for tools that still have no real integration wired up
   yet, so existing manual workflows don't break while you migrate them
   one at a time.
4. **Keep every existing assertion in force.** `assertScopeDenied` and
   `assertExternalApproved` still run before your new code executes
   anything — do not bypass them "just for this tool." That governance is
   the entire point of the ToolAction model; a real integration that
   skips it is a regression, not a feature.
5. **Test it the way this codebase tests every AI/network call**: mock the
   real client at the module boundary (`vi.mock`), assert the
   `'unavailable'` path never throws and never blocks the mission, and add
   a `// @vitest-environment node` first line if the module imports
   `server-only`.
6. **Report back what's real vs. simulated.** If the target system doesn't
   have a sandbox/test mode, say so plainly rather than "testing" against
   production by accident.

## Worked example shape (MCP server, External scope)

```ts
// src/lib/business/forge/tool-execute-example.ts
import 'server-only';

export async function executeExampleTool(
  payload: Record<string, unknown>,
): Promise<{ status: 'ok'; resultRef: string } | { status: 'unavailable'; reason: string }> {
  const serverUrl = process.env.EXAMPLE_MCP_SERVER_URL;
  if (!serverUrl) return { status: 'unavailable', reason: 'not configured' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(serverUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { status: 'unavailable', reason: `HTTP ${res.status}` };
    const data = await res.json();
    return { status: 'ok', resultRef: data.id ?? data.url ?? JSON.stringify(data) };
  } catch (err) {
    console.error('[forge] executeExampleTool failed:', err);
    return { status: 'unavailable', reason: 'request failed' };
  }
}
```

Wire this into `executeToolAction` behind a `tool === 'example'` branch,
falling back to the existing manual `resultRef` behavior for every other
`tool` name until it's migrated too.

## Explicit non-goals of this skill

- Does not cover SSO, KMS/BYOK, or SOC-2/GDPR/FedRAMP readiness — those are
  identity/infrastructure/compliance work, not tool-calling. Handled
  separately (a distinct gap-analysis approach, not this recipe).
- Does not invent which external systems CariForge should integrate with —
  always a real decision from the user, never guessed.
- Does not build a generic "plug in anything" abstraction speculatively —
  wire up one real, chosen system at a time, and only once it has real
  credentials behind it. An integration layer with nothing real connected
  to it is exactly the kind of unused scaffolding this skill exists to
  avoid repeating.
