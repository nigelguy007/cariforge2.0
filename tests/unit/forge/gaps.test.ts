// @polsia:user-owned — gap-list stability coverage. Asserts the strings are
// present + stable so a future implementer can't silently remove a known gap.
import { describe, expect, it } from 'vitest';
import { FORGE_GAPS } from '@/lib/business/forge/gaps';

describe('forge gap list', () => {
  it('has at least 4 gap entries', () => {
    expect(FORGE_GAPS.length).toBeGreaterThanOrEqual(4);
  });
  it('each gap has a non-empty title and detail', () => {
    for (const gap of FORGE_GAPS) {
      expect(gap.title.trim().length).toBeGreaterThan(0);
      expect(gap.detail.trim().length).toBeGreaterThan(20);
    }
  });
  it('explicitly notes TAG Caribbean / Mirror exclusion', () => {
    expect(FORGE_GAPS.some((g) => /TAG Caribbean|Mirror/i.test(`${g.title} ${g.detail}`))).toBe(
      true,
    );
  });
  it('explicitly notes no AGI claim', () => {
    expect(FORGE_GAPS.some((g) => /no AGI claim|AGI/i.test(`${g.title} ${g.detail}`))).toBe(true);
  });
  it('explicitly notes no marketplace', () => {
    expect(FORGE_GAPS.some((g) => /no marketplace/i.test(`${g.title} ${g.detail}`))).toBe(true);
  });
  it('explicitly notes no specialist runtime', () => {
    expect(
      FORGE_GAPS.some((g) => /no specialist runtime|specialist/i.test(`${g.title} ${g.detail}`)),
    ).toBe(true);
  });
});
