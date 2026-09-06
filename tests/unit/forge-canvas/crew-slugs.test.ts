// PR A1: every configurator agent role must map to a real seeded Forge
// Crew slug, and every mapped slug must actually be seeded (src/lib/seed.ts
// upserts it). seed.ts isn't importable as pure data (it's an async DB
// writer), so this reads its source text rather than pulling in Prisma —
// same pattern as tests/unit/ownership-map.test.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREW_SLUG_BY_ROLE } from '@/lib/business/forge-canvas/crew-slugs';
import { CONFIGURATOR_AGENT_VALUES } from '@/lib/contracts/configurator';

const seedSource = readFileSync(join(process.cwd(), 'src/lib/seed.ts'), 'utf-8');

describe('CREW_SLUG_BY_ROLE', () => {
  it('has a slug for every configurator agent role', () => {
    for (const role of CONFIGURATOR_AGENT_VALUES) {
      expect(CREW_SLUG_BY_ROLE[role], `missing slug for role "${role}"`).toBeTruthy();
    }
    expect(Object.keys(CREW_SLUG_BY_ROLE).sort()).toEqual([...CONFIGURATOR_AGENT_VALUES].sort());
  });

  it('every mapped slug is actually seeded in src/lib/seed.ts', () => {
    for (const slug of Object.values(CREW_SLUG_BY_ROLE)) {
      expect(seedSource.includes(`slug: '${slug}'`), `"${slug}" is not seeded`).toBe(true);
    }
  });

  it('every mapped slug uses the forge-* namespace, never ops-*', () => {
    for (const slug of Object.values(CREW_SLUG_BY_ROLE)) {
      expect(slug.startsWith('forge-')).toBe(true);
    }
  });
});
