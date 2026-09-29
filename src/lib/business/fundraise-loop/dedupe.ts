// @polsia:user-owned — identity normalisation for the fundraise loop's
// "never contact twice" rule. Pure (no I/O) so it is unit-testable.
//
// A person can reach the loop under several identifiers (LinkedIn handle,
// email, name+firm). dedupeKeysFor() derives ALL of them; the store records
// every one in FundraiseIdentity, and a new row is a duplicate if ANY of its
// keys is already known. dedupeKeyFor() picks the strongest single key
// (LinkedIn handle > email > name+firm) for the prospect row itself. Event
// import resolves an identifier into the same key space, so a HeyReach export
// keyed by LinkedIn URL or by email matches a prospect sourced from 8Raise.

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Extracts the /in/<handle> from any LinkedIn profile URL form. Order
 * matters: percent-decode FIRST (so `%4A` and `J` agree), then NFC-normalise
 * (so precomposed and decomposed accents agree), then lowercase, then strip
 * trailing slashes.
 */
export function linkedinHandle(url: string): string | null {
  const m = url.trim().match(/linkedin\.com\/(?:mwlite\/)?in\/([^?#\s]+)/i);
  const raw = m?.[1];
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  // Only the first path segment is the handle (…/in/jane-doe/details/…).
  const handle = decoded.replace(/^\/+/, '').split('/')[0] ?? '';
  const out = handle.normalize('NFC').toLowerCase().replace(/\/+$/, '').trim();
  return out.length > 0 ? out : null;
}

type IdentityFields = {
  linkedinUrl?: string | null;
  email?: string | null;
  fullName?: string | null;
  firm?: string | null;
};

function liKey(p: IdentityFields): string | null {
  if (!p.linkedinUrl) return null;
  const h = linkedinHandle(p.linkedinUrl);
  return h ? `li:${h}` : null;
}

function emKey(p: IdentityFields): string | null {
  if (!p.email?.includes('@')) return null;
  return `em:${p.email.trim().normalize('NFC').toLowerCase()}`;
}

function nfKey(p: IdentityFields): string | null {
  if (!p.fullName || !p.firm) return null;
  const n = norm(p.fullName);
  const f = norm(p.firm);
  return n && f ? `nf:${n}|${f}` : null;
}

/** The strongest single key — stored on the prospect row. */
export function dedupeKeyFor(p: IdentityFields): string | null {
  return liKey(p) ?? emKey(p) ?? nfKey(p);
}

/** Every key derivable from the record (li, em, nf), strongest first. */
export function dedupeKeysFor(p: IdentityFields): string[] {
  return [liKey(p), emKey(p), nfKey(p)].filter((k): k is string => k !== null);
}

/**
 * Resolves a free-form identifier (LinkedIn URL, email, or "Name | Firm")
 * from an event import to the prospect key space.
 */
export function dedupeKeyForIdentifier(identifier: string): string | null {
  const id = identifier.trim();
  if (/linkedin\.com\//i.test(id)) return dedupeKeyFor({ linkedinUrl: id });
  if (id.includes('@')) return dedupeKeyFor({ email: id });
  const [name, firm] = id.split('|');
  if (name && firm) return dedupeKeyFor({ fullName: name, firm });
  return null;
}
