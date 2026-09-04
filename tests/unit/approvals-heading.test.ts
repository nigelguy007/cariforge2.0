// The Approvals heading is the brief's own copy: the count in words, then
// "need(s) you"; zero reads "You have no approvals waiting".
import { describe, expect, it } from 'vitest';
import { approvalsHeading } from '@/components/custom/app/approvals-queue';

describe('approvalsHeading', () => {
  it('reads plainly at zero', () => {
    expect(approvalsHeading(0)).toBe('You have no approvals waiting');
  });

  it('uses words up to ten and agrees the verb', () => {
    expect(approvalsHeading(1)).toBe('One approval needs you');
    expect(approvalsHeading(2)).toBe('Two approvals need you');
    expect(approvalsHeading(10)).toBe('Ten approvals need you');
  });

  it('falls back to digits above ten', () => {
    expect(approvalsHeading(11)).toBe('11 approvals need you');
  });
});
