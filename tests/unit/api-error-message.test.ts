// @polsia:user-owned — apiErrorMessage extracts the real server message from
// an apiFetch failure. Two response shapes exist across /api/forge/* routes:
// `{ error: string }` (a curated message, e.g. forgeErrorResponse) and
// `{ errors: Record<string,string> }` (a 400 field-validation failure, every
// POST route's own `fieldErrorBody` convention). A caller with no form
// fields to attribute per-field errors to (a chat UI, not a form) had no way
// to surface the second shape and silently fell back to its own generic
// text — found live in production (2026-09-05) via the intake chat's 400s.
import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from '@/lib/api-error-message';

function apiFetchError(cause: unknown): Error {
  return new Error('apiFetch /api/x failed (400)', { cause });
}

describe('apiErrorMessage', () => {
  it('returns the curated message from a { error } cause', () => {
    expect(apiErrorMessage(apiFetchError({ error: 'Gate 0 is locked.' }), 'fallback')).toBe(
      'Gate 0 is locked.',
    );
  });

  it('joins field messages from a { errors } cause', () => {
    const err = apiFetchError({ errors: { messages: 'Message must not be empty.' } });
    expect(apiErrorMessage(err, 'fallback')).toBe('Message must not be empty.');
  });

  it('joins multiple field messages into one readable line', () => {
    const err = apiFetchError({
      errors: { need: 'Required field.', constraints: 'Too long.' },
    });
    const message = apiErrorMessage(err, 'fallback');
    expect(message).toContain('Required field.');
    expect(message).toContain('Too long.');
  });

  it('falls back when there is no cause at all', () => {
    expect(apiErrorMessage(new Error('plain error'), 'fallback')).toBe('fallback');
  });

  it('falls back when errors is present but empty', () => {
    expect(apiErrorMessage(apiFetchError({ errors: {} }), 'fallback')).toBe('fallback');
  });
});
