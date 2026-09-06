// @polsia:user-owned — shared zod contract for the chat-based project-intake
// flow. Client-importable: zod only, no server-only imports (same rule as
// contracts/forge.ts). This is a thin front end for MissionCreate — the chat
// gathers the same MissionIntakeStructure fields conversationally instead of
// via a static form, and the client maps IntakeChatResponse straight into a
// MissionCreate payload once readyToSubmit is true.

import { z } from 'zod';

export const IntakeChatMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type IntakeChatMessageT = z.infer<typeof IntakeChatMessage>;

export const IntakeChatRequest = z.object({
  messages: z.array(IntakeChatMessage).min(1).max(60),
});
export type IntakeChatRequestT = z.infer<typeof IntakeChatRequest>;

// Every field is REQUIRED, never `.optional()` — mirrors the hard lesson
// already learned in ai-draft.ts (see that file's header comment): an
// Anthropic structured-output schema with optional fields can hang
// indefinitely against this model/gateway rather than completing quickly.
// The business-logic layer's system prompt is responsible for instructing
// the model to return an empty string / empty array for anything not yet
// known, never omit a field.
export const IntakeChatResponse = z.object({
  reply: z.string(),
  readyToSubmit: z.boolean(),
  projectName: z.string(),
  intake: z.string(),
  need: z.string(),
  intendedOutcome: z.string(),
  constraints: z.string(),
  authorityBoundary: z.string(),
  dataClassification: z.string(),
  retentionPolicy: z.string(),
  acceptanceCriteria: z.string(),
  nonGoals: z.string(),
  missionOwner: z.string(),
  missingInformation: z.array(z.string()),
});
export type IntakeChatResponseT = z.infer<typeof IntakeChatResponse>;
