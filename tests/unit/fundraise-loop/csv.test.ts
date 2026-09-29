// @polsia:user-owned — pins the /admin/fundraise outcome CSV parser.
import { describe, expect, it } from 'vitest';
import { parseOutcomeCsv, splitCsvLine } from '@/lib/business/fundraise-loop/csv';
import { EventIngest } from '@/lib/contracts/fundraise-loop';

describe('parseOutcomeCsv', () => {
  it('parses the three identifier shapes', () => {
    const { events, errors } = parseOutcomeCsv(
      [
        'https://www.linkedin.com/in/jane-doe,REPLY,2026-09-20',
        'jane@fund.vc,meeting,2026-09-21,Intro call booked',
        'Ann Lee | Coral Ventures,second meeting,2026-09-22',
      ].join('\n'),
    );
    expect(errors).toEqual([]);
    expect(events).toEqual([
      {
        identifier: 'https://www.linkedin.com/in/jane-doe',
        type: 'REPLY',
        occurredAt: '2026-09-20',
      },
      {
        identifier: 'jane@fund.vc',
        type: 'MEETING',
        occurredAt: '2026-09-21',
        note: 'Intro call booked',
      },
      { identifier: 'Ann Lee | Coral Ventures', type: 'SECOND_MEETING', occurredAt: '2026-09-22' },
    ]);
  });

  it('keeps commas in the note and honours quoted fields', () => {
    const { events, errors } = parseOutcomeCsv(
      'a@b.co,PASS,2026-09-01,too early, revisit Q2\n"Smith, J | Fund",term-sheet,2026-09-02,"said ""yes"""',
    );
    expect(errors).toEqual([]);
    expect(events[0]?.note).toBe('too early, revisit Q2');
    expect(events[1]).toEqual({
      identifier: 'Smith, J | Fund',
      type: 'TERM_SHEET',
      occurredAt: '2026-09-02',
      note: 'said "yes"',
    });
  });

  it('skips blank lines, comments, and a header row', () => {
    const { events, errors } = parseOutcomeCsv(
      '\nidentifier,type,date,note\n# replies this week\n\nx@y.co,BOUNCE,2026-09-03\n',
    );
    expect(errors).toEqual([]);
    expect(events).toHaveLength(1);
  });

  it('reports row-level errors with 1-based line numbers', () => {
    const { events, errors } = parseOutcomeCsv(
      [
        'ok@x.co,REPLY,2026-09-01',
        'bad-type@x.co,EMAIL,2026-09-01',
        'bad-date@x.co,REPLY,2026-02-30',
        'bad-format@x.co,REPLY,09/01/2026',
        'too-few,REPLY',
        ',REPLY,2026-09-01',
        '"unclosed,REPLY,2026-09-01',
      ].join('\n'),
    );
    expect(events).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(errors[0]?.message).toMatch(/Unknown type "EMAIL"/);
    expect(errors[1]?.message).toMatch(/2026-02-30/);
    expect(errors[3]?.message).toMatch(/Expected identifier,type,date/);
    expect(errors[4]?.message).toMatch(/Identifier is empty/);
    expect(errors[5]?.message).toMatch(/Unclosed/);
  });

  it('handles CRLF input', () => {
    const { events, errors } = parseOutcomeCsv(
      'a@b.co,REPLY,2026-09-01\r\nc@d.co,PASS,2026-09-02\r\n',
    );
    expect(errors).toEqual([]);
    expect(events).toHaveLength(2);
  });

  it('flags batches over the API limit', () => {
    const text = Array.from({ length: 1001 }, (_, i) => `p${i}@x.co,REPLY,2026-09-01`).join('\n');
    const { errors } = parseOutcomeCsv(text);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/Too many rows/);
  });

  it('produces events the shared EventIngest contract accepts', () => {
    const { events } = parseOutcomeCsv('a@b.co,MEETING,2026-09-01,note');
    const parsed = EventIngest.parse({ events });
    expect(parsed.events[0]?.occurredAt).toBeInstanceOf(Date);
    expect(parsed.events[0]?.occurredAt.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('splitCsvLine', () => {
  it('returns raw fields and unwraps quoted ones', () => {
    expect(splitCsvLine(' a , " b ",c').fields).toEqual([' a ', ' b ', 'c']);
  });
});
