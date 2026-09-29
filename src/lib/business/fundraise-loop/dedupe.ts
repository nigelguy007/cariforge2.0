// @polsia:user-owned — identity normalisation for the fundraise loop's
// "never contact twice" rule. Pure (no I/O) so it is unit-testable.
//
// Precedence: LinkedIn handle > email > name+firm. A prospect row stores the
// strongest key available; event import resolves an identifier to the same
// key space, so a HeyReach export keyed by LinkedIn URL matches a prospect
// sourced from 8Raise.

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Extracts the /in/<handle> from any LinkedIn profile URL form. */
export function linkedinHandle(url: string): string | null {
  const m = url
    .trim()
    .toLowerCase()
    .match(/linkedin\.com\/(?:mwlite\/)?in\/([^/?#\s]+)/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]).replace(/\/+$/, '');
  } catch {
    return m[1];
  }
}

export function dedupeKeyFor(p: {
  linkedinUrl?: string | null;
  email?: string | null;
  fullName?: string | null;
  firm?: string | null;
}): string | null {
  if (p.linkedinUrl) {
    const h = linkedinHandle(p.linkedinUrl);
    if (h) return `li:${h}`;
  }
  if (p.email?.includes('@')) return `em:${p.email.trim().toLowerCase()}`;
  if (p.fullName && p.firm) {
    const n = norm(p.fullName);
    const f = norm(p.firm);
    if (n && f) return `nf:${n}|${f}`;
  }
  return null;
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
