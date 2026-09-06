// @polsia:user-owned — real user report (2026-09-06): a completed mission's
// generated code files and technical spec were sitting in StageHandoff.payload
// all along, but no UI anywhere ever rendered them — "the build is complete
// however i dont see the files and spec as expected." Confirmed live: the
// data was there (20 files, architectureOverview, deploymentNotes all
// present); this file is the fix — the read path that turns that stored
// payload into (a) a real "MVP to Production" roadmap document (generated
// once, cached — see MissionDeliverable in forge.prisma) and (b) a
// downloadable .zip of every file plus two written documents, so a buyer's
// own team has something real to open and act on, not just a summary
// sentence.
import 'server-only';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Prisma } from '@prisma/client';
import JSZip from 'jszip';
import { z as z4 } from 'zod/v4';
import { prisma } from '@/lib/db';
import { getClient } from './ai-draft';

export interface DeliverableFile {
  readonly path: string;
  readonly content: string;
}

/** The subset of the SoftwareBuild handoff payload this file actually
 *  reads. Deliberately loose (Record, not the full SoftwareBuildPlan type
 *  from build-job.ts) — this reads payloads written by whatever version of
 *  that generator was live at build time, and must not throw on an older
 *  or slightly different shape; every field is defensively coerced below. */
export interface SoftwareBuildPayload {
  readonly summary: string;
  readonly techStack: readonly string[];
  readonly architectureOverview: string;
  readonly dataModel: string;
  readonly apiSurface: readonly string[];
  readonly deploymentNotes: string;
  readonly files: readonly DeliverableFile[];
}

function asStringArray(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Reads the mission's active SoftwareBuild handoff payload into the shape
 *  this file needs, or null if that stage hasn't produced one — a mission
 *  that hasn't reached/cleared Software Build yet has nothing to show here,
 *  which is a real, honest state, not an error. */
export function readSoftwareBuildPayload(payload: unknown): SoftwareBuildPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const rawFiles = Array.isArray(p.files) ? p.files : [];
  const parsedFiles: DeliverableFile[] = rawFiles
    .filter(
      (f): f is Record<string, unknown> =>
        !!f && typeof f === 'object' && typeof (f as Record<string, unknown>).path === 'string',
    )
    .map((f) => ({
      path: f.path as string,
      content: typeof f.content === 'string' ? f.content : '',
    }));
  if (parsedFiles.length === 0) return null;
  return {
    summary: typeof p.summary === 'string' ? p.summary : '',
    techStack: asStringArray(p.techStack),
    architectureOverview: typeof p.architectureOverview === 'string' ? p.architectureOverview : '',
    dataModel: typeof p.dataModel === 'string' ? p.dataModel : '',
    apiSurface: asStringArray(p.apiSurface),
    deploymentNotes: typeof p.deploymentNotes === 'string' ? p.deploymentNotes : '',
    files: parsedFiles,
  };
}

// === THE ROADMAP =============================================================
// Every field required, never `.optional()` — see ai-draft.ts's StepDraftV4
// comment for the real, confirmed incident (mostly-optional fields hanging
// indefinitely against this Gateway) that rule protects against.
const ProductionRoadmapV4 = z4.object({
  summary: z4.string(),
  securitySteps: z4.array(z4.string()).min(1),
  infrastructureSteps: z4.array(z4.string()).min(1),
  dataSteps: z4.array(z4.string()).min(1),
  observabilitySteps: z4.array(z4.string()).min(1),
  testingSteps: z4.array(z4.string()).min(1),
  costConsiderations: z4.array(z4.string()).min(1),
  recommendedOrder: z4.array(z4.string()).min(1),
});
export type ProductionRoadmap = z4.infer<typeof ProductionRoadmapV4>;

const DELIVERABLE_KIND_ROADMAP = 'ProductionRoadmap';

async function generateProductionRoadmap(
  spec: SoftwareBuildPayload,
): Promise<ProductionRoadmap | null> {
  const client = getClient();
  if (!client) return null;

  const system = `You are CariForge, writing the "MVP to Production" roadmap that ships
alongside an approved MVP build — a real, actionable document a buyer's
own engineering team reads to plan the next stage of work. It is not a
recap of the MVP; it is honest, concrete guidance on what a genuine
production rollout of THIS SPECIFIC build still needs, grounded in its
real tech stack and architecture below. Every list item must be a
specific, actionable recommendation (name the concern and what to do
about it) — never a generic platitude like "add more tests" with no
detail on what to test or why.

The MVP's real architecture: ${spec.architectureOverview}
Tech stack: ${spec.techStack.join(', ')}
Data model: ${spec.dataModel}
API surface: ${spec.apiSurface.join('; ') || 'none published'}
The MVP's own deployment notes: ${spec.deploymentNotes}
Files in this build: ${spec.files.map((f) => f.path).join(', ')}

Produce:
- summary: 2-3 sentences framing what "production-ready" actually means
  for this specific build, given its real scope.
- securitySteps: concrete security/compliance hardening this build still
  needs before real traffic (auth hardening, secrets management, input
  validation gaps, dependency scanning — specific to what's actually here).
- infrastructureSteps: concrete infrastructure/deployment steps (hosting,
  CI/CD, environment separation, scaling posture) specific to this stack.
- dataSteps: concrete data steps (migrating off any dev/local database,
  backups, retention, data-minimisation) specific to this data model.
- observabilitySteps: concrete monitoring/logging/alerting/error-tracking
  this build doesn't yet have.
- testingSteps: concrete test-coverage gaps to close before production,
  named against the real files/surface above, not generic advice.
- costConsiderations: concrete, realistic cost/scaling factors for this
  specific stack at real traffic.
- recommendedOrder: the steps above, referenced by short name, in the
  order a team should actually tackle them — sequenced, not a shuffle.`;

  try {
    const response = await client.messages.parse(
      {
        model: 'anthropic/claude-sonnet-5',
        max_tokens: 4_000,
        output_config: { effort: 'medium', format: zodOutputFormat(ProductionRoadmapV4) },
        system,
        messages: [{ role: 'user', content: 'Write the MVP-to-production roadmap now.' }],
      },
      { timeout: 60_000 },
    );
    if (!response.parsed_output) return null;
    const parsed = ProductionRoadmapV4.safeParse(response.parsed_output);
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.error('[forge] generateProductionRoadmap failed:', err);
    return null;
  }
}

/** Generated once per mission, then cached in MissionDeliverable — repeat
 *  calls (a second page view, a re-download) read the cached row instead
 *  of re-running the AI call. Returns null only if generation genuinely
 *  fails (degrades gracefully — callers already handle a missing roadmap
 *  by omitting that section, same posture as the rest of this AI-backed
 *  pipeline). */
export async function getOrCreateProductionRoadmap(
  missionId: string,
  spec: SoftwareBuildPayload,
): Promise<ProductionRoadmap | null> {
  const existing = await prisma.missionDeliverable.findUnique({
    where: { missionId_kind: { missionId, kind: DELIVERABLE_KIND_ROADMAP } },
  });
  if (existing) return existing.content as unknown as ProductionRoadmap;

  const roadmap = await generateProductionRoadmap(spec);
  if (!roadmap) return null;

  await prisma.missionDeliverable
    .create({
      data: {
        missionId,
        kind: DELIVERABLE_KIND_ROADMAP,
        // Cast, not `any`: ProductionRoadmap's inferred type is a plain
        // JSON-compatible object at runtime, but zod/v4's inferred type
        // doesn't structurally satisfy Prisma's InputJsonValue — same
        // known gap as build-job.ts's `files` field cast.
        content: roadmap as unknown as Prisma.InputJsonValue,
      },
    })
    // A concurrent request may have created the row first (the @@unique
    // constraint would reject a second insert) — that's fine, this call's
    // own freshly-generated roadmap is still valid to return even if it
    // didn't win the race to be cached.
    .catch((err) => {
      console.error('[forge] caching production roadmap failed (non-fatal):', err);
    });

  return roadmap;
}

// === DOCUMENTS ================================================================

function architectureMarkdown(spec: SoftwareBuildPayload): string {
  const lines = [
    '# Technical Architecture',
    '',
    spec.summary || 'No summary was recorded for this build.',
    '',
    '## Architecture overview',
    '',
    spec.architectureOverview || '_Not recorded._',
    '',
    '## Tech stack',
    '',
    ...(spec.techStack.length > 0 ? spec.techStack.map((t) => `- ${t}`) : ['_Not recorded._']),
    '',
    '## Data model',
    '',
    spec.dataModel || '_Not recorded._',
    '',
    '## API surface',
    '',
    ...(spec.apiSurface.length > 0 ? spec.apiSurface.map((a) => `- ${a}`) : ['_None published._']),
    '',
    '## Deployment notes (as generated with the build)',
    '',
    spec.deploymentNotes || '_Not recorded._',
    '',
    '## Files in this build',
    '',
    ...spec.files.map((f) => `- \`${f.path}\``),
    '',
  ];
  return lines.join('\n');
}

function roadmapMarkdown(roadmap: ProductionRoadmap | null): string {
  if (!roadmap) {
    return [
      '# MVP to Production Roadmap',
      '',
      'This roadmap could not be generated for this build. Re-open this project’s',
      'deliverables page to try again, or contact CariForge for help.',
      '',
    ].join('\n');
  }
  const section = (title: string, items: readonly string[]) =>
    [`## ${title}`, '', ...items.map((i) => `- ${i}`), ''].join('\n');
  return [
    '# MVP to Production Roadmap',
    '',
    roadmap.summary,
    '',
    section('Recommended order', roadmap.recommendedOrder),
    section('Security & compliance', roadmap.securitySteps),
    section('Infrastructure & deployment', roadmap.infrastructureSteps),
    section('Data', roadmap.dataSteps),
    section('Observability', roadmap.observabilitySteps),
    section('Testing', roadmap.testingSteps),
    section('Cost & scaling considerations', roadmap.costConsiderations),
  ].join('\n');
}

/** Builds the full downloadable .zip: every generated file at its real
 *  relative path, plus two written documents at the root — ARCHITECTURE.md
 *  (composed directly from the stored spec, no AI call, so it's instant
 *  and works even if the roadmap failed to generate) and
 *  MVP_TO_PRODUCTION.md (the cached/generated roadmap above). */
export async function buildDeliverablesZip(
  missionId: string,
  missionTitle: string,
  spec: SoftwareBuildPayload,
  roadmap: ProductionRoadmap | null,
): Promise<Buffer> {
  const zip = new JSZip();
  for (const file of spec.files) {
    zip.file(file.path, file.content);
  }
  zip.file('ARCHITECTURE.md', architectureMarkdown(spec));
  zip.file('MVP_TO_PRODUCTION.md', roadmapMarkdown(roadmap));
  zip.file(
    'README.md',
    [
      `# ${missionTitle}`,
      '',
      spec.summary || 'No summary was recorded for this build.',
      '',
      'See ARCHITECTURE.md for the technical design and MVP_TO_PRODUCTION.md for',
      'concrete next steps to take this from MVP to a production deployment.',
      '',
      `Generated by CariForge for mission ${missionId}.`,
      '',
    ].join('\n'),
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
