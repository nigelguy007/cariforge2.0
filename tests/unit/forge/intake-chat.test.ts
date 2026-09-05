// @vitest-environment node — intake-chat.ts imports 'server-only' directly;
// see tests/unit/forge/ai-draft.test.ts's header comment for why jsdom (the
// suite default) can't run this without it.
//
// @polsia:user-owned — mirrors ai-draft.test.ts's exact pattern. The
// behavioural guarantee that matters most: a missing/unusable AI Gateway key
// must degrade to { status: 'unavailable' } and never throw, because a chat
// outage must never be the reason a project can't be started (the static
// MissionIntakeForm is the manual fallback). Also covers the happy path with
// a mocked Anthropic response, asserting it passes through unmodified.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ENV_KEYS = ['AI_GATEWAY_API_KEY', 'ANTHROPIC_API_KEY'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.doUnmock('@anthropic-ai/sdk');
  vi.restoreAllMocks();
});

describe('intakeChatTurn — no usable AI Gateway key', () => {
  it('returns { status: "unavailable" } rather than throwing', async () => {
    const { intakeChatTurn } = await import('@/lib/business/forge/intake-chat');
    const result = await intakeChatTurn({
      messages: [{ role: 'user', content: 'We need help triaging compliance claims.' }],
    });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('returns { status: "unavailable" } for an empty message list', async () => {
    const { intakeChatTurn } = await import('@/lib/business/forge/intake-chat');
    const result = await intakeChatTurn({ messages: [] });
    expect(result).toEqual({ status: 'unavailable' });
  });
});

describe('intakeChatTurn — happy path', () => {
  it('passes a mocked Anthropic structured response through unmodified', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const parsedOutput = {
      reply: 'Got it — what does success look like once this is solved?',
      readyToSubmit: false,
      projectName: '',
      intake: '',
      need: 'A compliance team manually checks each claim for a required disclosure.',
      intendedOutcome: '',
      constraints: '',
      authorityBoundary: '',
      dataClassification: '',
      retentionPolicy: '',
      acceptanceCriteria: '',
      nonGoals: '',
      missionOwner: '',
      missingInformation: [],
    };

    const parseMock = vi.fn().mockResolvedValue({ parsed_output: parsedOutput });
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: { parse: parseMock },
      })),
    }));

    const { intakeChatTurn } = await import('@/lib/business/forge/intake-chat');
    const result = await intakeChatTurn({
      messages: [
        { role: 'assistant', content: "Hi, I'm CariForge. What's not working today?" },
        { role: 'user', content: 'A compliance team manually checks each claim by hand.' },
      ],
    });

    expect(result).toEqual({ status: 'ok', result: parsedOutput });
    expect(parseMock).toHaveBeenCalledTimes(1);
    const call = parseMock.mock.calls[0]?.[0];
    expect(call.model).toBe('anthropic/claude-sonnet-5');
    expect(call.messages).toEqual([
      { role: 'assistant', content: "Hi, I'm CariForge. What's not working today?" },
      { role: 'user', content: 'A compliance team manually checks each claim by hand.' },
    ]);
  });

  // Real bug found live in production (2026-09-05): `reply` had no
  // `.min(1)` — the model could legally return "". The client pushes
  // whatever `reply` comes back straight into conversation history as an
  // assistant message; every later turn re-sends that full history, and
  // IntakeChatRequest's own per-message `content.min(1)` then
  // permanently 400s on it — the conversation never recovers without a
  // page refresh. intakeChatTurn must never let an empty reply out.
  it('substitutes a fallback when the model returns an empty reply', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const parsedOutput = {
      reply: '   ',
      readyToSubmit: false,
      projectName: '',
      intake: '',
      need: '',
      intendedOutcome: '',
      constraints: '',
      authorityBoundary: '',
      dataClassification: '',
      retentionPolicy: '',
      acceptanceCriteria: '',
      nonGoals: '',
      missionOwner: '',
      missingInformation: [],
    };

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: { parse: vi.fn().mockResolvedValue({ parsed_output: parsedOutput }) },
      })),
    }));

    const { intakeChatTurn } = await import('@/lib/business/forge/intake-chat');
    const result = await intakeChatTurn({
      messages: [{ role: 'user', content: 'We need help triaging compliance claims.' }],
    });

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.result.reply.trim().length > 0).toBe(true);
  });
});
