// @polsia:user-owned — static dataset for the seven-agent core model. Server-only:
// imported by /api/agents/route.ts, which parses it through the shared
// CoreAgents contract. Lists the canonical seven agents that operate the
// CARI Forge pipeline and wraparound: 1 Discovery, 2 Readiness, 3 Workflow,
// 4 Governance, 5 AI Build, 6 Partner, 7 Impact. Agents 1..5 are the
// pipeline runtime — Agent 1..5 operate Stage 1..5 of the 21-day delivery
// pipeline respectively (notably Agent 5 = AI Build operates Stage 5, whose
// stage name is "Software Build"). Agents 6..7 are wraparound: Partner engages
// the buyer / integrator ecosystem post-delivery, Impact measures the change
// in the world. No DB, no AI call — pure editorial catalog copy.

import 'server-only';
import type { CoreAgents } from '@/lib/contracts/agents';

export const CORE_AGENTS: CoreAgents = {
  items: [
    {
      id: 'discovery',
      ordinal: 1,
      role: 'Discovery',
      roleLong: 'Need Discovery agent',
      mandate:
        'Translates a one-line inbound brief into a testable problem statement card with named must-not-happen clauses and a named buyer approver. The case is only legible to the rest of the pipeline once Discovery has approved the framing.',
      relatesToStage: 'Discovery',
      scope: 'Pipeline',
      boundary: {
        inputs: ['The inbound requirements brief', 'A named buyer approver'],
        tools: ['Case file record (create/read)', 'Problem-statement template'],
        outputs: [
          'A testable problem statement',
          'Named must-not-happen clauses',
          'The Discovery gate decision request',
        ],
        prohibited: [
          'Cannot approve its own gate',
          'Cannot start designing the workflow or writing code ahead of Readiness and Governance',
        ],
        humanApproval:
          'A named buyer approver must approve, return, or refuse the Discovery gate — with a typed reason recorded — before Readiness starts.',
        evidence: [
          'The problem statement card',
          'The gate decision record with its typed reason',
          'A timestamped case file entry',
        ],
        successMeasures: [
          'Time to a testable, unambiguous problem statement',
          'Gate return rate (fewer returns signal a clearer initial framing)',
        ],
      },
    },
    {
      id: 'readiness',
      ordinal: 2,
      role: 'Readiness',
      roleLong: 'Readiness Review agent',
      mandate:
        'Audits data sources, integrations, and regulatory regimes before code. Writes the build-versus-buy comparison statement to the case file (FRISS / Shift / Guidewire ClaimCenter or equivalent) and locks the data-minimisation clause.',
      relatesToStage: 'Readiness',
      scope: 'Pipeline',
      boundary: {
        inputs: [
          'The approved Discovery problem statement',
          'Buyer-supplied data samples and documents',
          'The buyer-named systems of record relevant to the case',
        ],
        tools: [
          'Case file record',
          'Build-versus-buy comparison template',
          'Data-minimisation checklist',
        ],
        outputs: [
          'An audit of the relevant data sources, integrations, and regulatory regime',
          'A build-versus-buy comparison statement',
          'A locked data-minimisation clause',
        ],
        prohibited: [
          'Cannot access any data the buyer has not explicitly supplied or named',
          'Cannot recommend a build over an adequate off-the-shelf option without a written justification',
        ],
        humanApproval:
          'A named buyer approver approves, returns, or refuses the Readiness gate with a typed reason.',
        evidence: [
          'The readiness audit record',
          'The comparison statement',
          'The gate decision record',
        ],
        successMeasures: ['Readiness gate pass rate', 'Data-minimisation clause compliance'],
      },
    },
    {
      id: 'workflow',
      ordinal: 3,
      role: 'Workflow',
      roleLong: 'Workflow Design agent',
      mandate:
        'Designs the role/escalation diagram for the proposed system: the human checkpoints, the SIU / Compliance / Officer gates, the per-regime SLAs, and the typed-note to the buyer on what the build unlocks downstream.',
      relatesToStage: 'Workflow',
      scope: 'Pipeline',
      boundary: {
        inputs: [
          'The approved Readiness audit',
          'The human checkpoints the buyer has named as required',
        ],
        tools: ['Case file record', 'Role/escalation diagram template'],
        outputs: [
          'The role/escalation diagram',
          'Per-regime SLAs',
          'A typed note to the buyer on what the build unlocks downstream',
        ],
        prohibited: [
          'Cannot remove a human checkpoint the buyer named as required',
          "Cannot finalise the binding governance spec — that's the Governance agent's gate",
        ],
        humanApproval:
          'A named buyer approver approves, returns, or refuses the Workflow gate with a typed reason.',
        evidence: ['The workflow design diagram', 'The gate decision record'],
        successMeasures: [
          'Escalation-path completeness',
          'SLA coverage per named regulatory regime',
        ],
      },
    },
    {
      id: 'governance',
      ordinal: 4,
      role: 'Governance',
      roleLong: 'Governance Check agent',
      // COPY ACCURACY (2026-09-03, rebuild-brief review — see the matching
      // note on 'ai-build' below for the full evidence trail): "every route
      // handler and prisma model below is derived from this matrix" implied
      // AI Build ships actual code artefacts. Softened to match what the
      // gate's own contract (GATE_DEFS[4] in src/lib/contracts/forge.ts)
      // says it hands off: a spec, not code.
      mandate:
        'Confirms the logging, oversight, and stop-the-line controls hold under the named human approvals at every gate. Produces the binding spec handed to Agent 5 (AI Build).',
      relatesToStage: 'Governance',
      scope: 'Pipeline',
      boundary: {
        inputs: [
          'The approved Workflow design',
          'The named human approver for every remaining gate',
        ],
        tools: ['Case file record', 'Gate/approval permission matrix', 'Audit-log schema'],
        outputs: [
          'The binding governance spec handed to AI Build',
          'Confirmation that logging, oversight, and stop-the-line controls hold',
        ],
        prohibited: [
          'Cannot approve its own gate',
          'Cannot hand a spec to AI Build without a confirmed named human approver at every remaining gate',
        ],
        humanApproval:
          'A named buyer approver approves, returns, or refuses the Governance gate — the last human checkpoint before code is written.',
        evidence: [
          'The governance spec document',
          'The gate decision record',
          'The full gate history to date',
        ],
        successMeasures: ['Governance gate pass rate', 'Control completeness against the spec'],
      },
    },
    {
      id: 'ai-build',
      ordinal: 5,
      role: 'AI Build',
      roleLong: 'AI Build agent',
      // COPY ACCURACY (2026-09-03, rebuild-brief review): was "ships the
      // runnable Next.js + TypeScript codebase... route handlers, the
      // append-only audit-trail prisma model" — overclaimed against the
      // product's own contract. This stage's real gate (GATE_DEFS[4] in
      // src/lib/contracts/forge.ts) is named 'Prototype spec approved', and
      // that file's own comment states its output is "a pair of
      // schema-versioned *specification* documents, not deployable code."
      // Rewritten to what the agent actually hands off, matching the fix
      // already made to the STAGES table on /how-it-works — this exact
      // mandate string was rendering on that page directly beneath the
      // corrected stage description, contradicting it. NOTE: the deeper
      // `boundary` fields below (tools/outputs/evidence/successMeasures)
      // still describe code-generation outputs ("The generated repository",
      // "Next.js + TypeScript code generation") — left untouched here.
      // Rewriting those accurately is a real, separate content decision
      // (what tools/outputs a spec-producing agent actually has) that
      // deserves its own dedicated pass, not a rushed patch alongside this.
      mandate:
        'Runs Stage 5 (Software Build) of the pipeline and produces the approved Blueprint and Runbook — the schema-versioned build spec — from the binding spec handed over by Governance. AI Build is the agent name; "Software Build" is the stage name it operates.',
      relatesToStage: 'Software Build',
      scope: 'Pipeline',
      boundary: {
        inputs: ['The binding governance spec from the Governance agent'],
        tools: [
          'Next.js + TypeScript code generation',
          'Prisma schema and migration authoring',
          'Route handler authoring',
        ],
        outputs: [
          'The runnable Next.js + TypeScript codebase',
          'The append-only audit-trail Prisma model',
          'The immutable hash chain',
          'A developer-facing case file receipt',
        ],
        prohibited: [
          'Cannot deviate from the binding governance spec without a new Governance gate approval',
          'Cannot release or deploy without the Software Build gate’s final approval',
        ],
        humanApproval:
          "A named buyer approver's final approve on the Software Build gate releases the build — approve, return, or refuse with a typed reason, the same as every other gate.",
        evidence: [
          'The generated repository',
          'Audit-trail records',
          'Hash-chain integrity',
          'The gate decision record',
        ],
        successMeasures: [
          'Build correctness against the governance spec',
          'Time from Governance approval to a runnable build',
        ],
      },
    },
    {
      id: 'partner',
      ordinal: 6,
      role: 'Partner',
      roleLong: 'Partner agent',
      // COPY ACCURACY (2026-09-03, rebuild-brief review, same evidence as
      // 'ai-build' above): "the runnable software build lands on
      // infrastructure" assumed a deployable artefact exists at this point,
      // which contradicts what Software Build's own gate actually produces.
      mandate:
        'Wraps around delivery. Engages the buyer-side integrator / GA / cloud partner ecosystem to take the approved build spec to the buyer’s own infrastructure. Not a stage — a wraparound that turns an approved spec into an operated system.',
      relatesToStage: 'Wraparound',
      scope: 'Wraparound',
      boundary: {
        inputs: [
          'The completed, gated Software Build',
          "The buyer's target infrastructure and environment",
        ],
        tools: [
          'Deployment handoff checklist',
          'Buyer-side integrator / cloud-partner coordination',
        ],
        outputs: [
          'The build running on buyer-controlled infrastructure',
          'Operational handoff documentation',
        ],
        prohibited: [
          'Cannot bypass the Software Build gate',
          'Cannot keep operating the build on CariForge-controlled infrastructure indefinitely — the point of this agent is a buyer-run system',
        ],
        humanApproval:
          "The buyer's own operations owner signs off that the build is live on their infrastructure and their people can run it.",
        evidence: ['The deployment handoff record', 'The buyer sign-off'],
        successMeasures: [
          "Successful handoff to the buyer's own infrastructure",
          'Time from build approval to live handoff',
        ],
      },
    },
    {
      id: 'impact',
      ordinal: 7,
      role: 'Impact',
      roleLong: 'Impact agent',
      mandate:
        'Wraps around delivery. Measures the change in the world the build was meant to make — the agreed unit economics in production (not on a slide), the kept promise on the named must-not-happen clauses, and the learning that flows back into the next brief. Not a stage — a wraparound.',
      relatesToStage: 'Wraparound',
      scope: 'Wraparound',
      boundary: {
        inputs: [
          'The live, buyer-operated build',
          'The agreed unit-economics targets from the case file',
          'The named must-not-happen clauses set by Discovery',
        ],
        tools: ['Outcome tracking against the original case file clauses'],
        outputs: [
          'A realised-value read-out against the original case',
          'Confirmation of whether the must-not-happen clauses held',
          'Learning fed back into the next brief',
        ],
        prohibited: [
          'Cannot retroactively alter the original must-not-happen clauses to improve a result',
        ],
        humanApproval:
          'A named buyer approver reviews and signs the Impact read-out — no gate blocks delivery at this point since the build is already live, but the read-out itself is a signed record.',
        evidence: ['The Impact read-out document', 'The case file closure record'],
        successMeasures: [
          'Must-not-happen clauses kept vs. broken',
          'Realised value against the original case',
        ],
      },
    },
  ],
} as const;
