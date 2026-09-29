// @polsia:user-owned — pure CSV parser for the /admin/fundraise "Record
// outcomes" box. Client-importable (no server imports, no zod runtime needed
// beyond the shared EVENT_TYPES list). Each non-blank line is
// `identifier,type,date[,note]`:
//   identifier — LinkedIn URL, email, or "Name | Firm"
//   type       — one of EVENT_TYPES (case-insensitive; spaces/dashes → _)
//   date       — YYYY-MM-DD (a real calendar date)
//   note       — optional; everything after the third comma, commas allowed
// Double-quoted fields are supported ("a, b" → a, b; "" → "). Blank lines,
// lines starting with `#`, and a leading `identifier,type,...` header are
// ignored. Errors are reported per 1-based source line so the UI can show
// them inline next to the text the founder pasted.

import { EVENT_TYPES, type EventType } from '@/lib/contracts/fundraise-loop';

export interface ParsedOutcomeEvent {
  identifier: string;
  type: EventType;
  /** Calendar date as typed, `YYYY-MM-DD`. The API coerces it to a Date. */
  occurredAt: string;
  note?: string;
}

export interface OutcomeCsvError {
  /** 1-based line number in the pasted text. */
  line: number;
  message: string;
}

export interface OutcomeCsvResult {
  events: ParsedOutcomeEvent[];
  errors: OutcomeCsvError[];
}

export const MAX_OUTCOME_EVENTS = 1000;
const MAX_IDENTIFIER = 500;
const MAX_NOTE = 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Split one CSV line into raw (untrimmed) fields, honouring double quotes. */
export function splitCsvLine(line: string): { fields: string[]; error?: string } {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' && current.trim() === '') {
      inQuotes = true;
      current = '';
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (inQuotes) return { fields: [], error: 'Unclosed double quote' };
  fields.push(current);
  return { fields };
}

function normaliseType(raw: string): EventType | null {
  const candidate = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return (EVENT_TYPES as readonly string[]).includes(candidate) ? (candidate as EventType) : null;
}

function isRealDate(raw: string): boolean {
  const m = DATE_RE.exec(raw);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isHeader(fields: string[]): boolean {
  return (
    fields[0]?.trim().toLowerCase() === 'identifier' && fields[1]?.trim().toLowerCase() === 'type'
  );
}

export function parseOutcomeCsv(text: string): OutcomeCsvResult {
  const events: ParsedOutcomeEvent[] = [];
  const errors: OutcomeCsvError[] = [];
  const lines = text.split(/\r\n|\n|\r/);
  let sawContent = false;

  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;

    const { fields, error } = splitCsvLine(trimmed);
    if (error) {
      errors.push({ line, message: error });
      sawContent = true;
      return;
    }
    if (!sawContent && isHeader(fields)) {
      sawContent = true;
      return;
    }
    sawContent = true;

    if (fields.length < 3) {
      errors.push({ line, message: 'Expected identifier,type,date[,note]' });
      return;
    }
    const [identifier = '', typeRaw = '', date = ''] = fields.map((f) => f.trim());
    const rest = fields.slice(3);
    const lineErrors: string[] = [];

    if (!identifier) lineErrors.push('Identifier is empty');
    else if (identifier.length > MAX_IDENTIFIER)
      lineErrors.push(`Identifier is longer than ${MAX_IDENTIFIER} characters`);

    const type = normaliseType(typeRaw);
    if (!type) lineErrors.push(`Unknown type "${typeRaw}" — use one of ${EVENT_TYPES.join(', ')}`);

    if (!isRealDate(date)) lineErrors.push(`Date "${date}" is not a valid YYYY-MM-DD date`);

    const note = rest.join(',').trim();
    if (note.length > MAX_NOTE) lineErrors.push(`Note is longer than ${MAX_NOTE} characters`);

    if (lineErrors.length > 0 || !type) {
      errors.push({ line, message: lineErrors.join('; ') });
      return;
    }
    events.push({
      identifier,
      type,
      occurredAt: date,
      ...(note ? { note } : {}),
    });
  });

  if (events.length > MAX_OUTCOME_EVENTS) {
    errors.push({
      line: 0,
      message: `Too many rows (${events.length}) — send at most ${MAX_OUTCOME_EVENTS} at a time`,
    });
  }

  return { events, errors };
}
