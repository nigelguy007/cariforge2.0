// PR A5: YAML is a projection of the canonical CARI Blueprint, never a
// second source of truth — round-tripping through it must reproduce the
// exact same definition, and a corrupted/invalid YAML document must fail
// the same CariBlueprintDefinition.parse() every other boundary uses.

import { describe, expect, it } from 'vitest';
import { blueprintToYaml, yamlToBlueprint } from '@/lib/business/forge-canvas/yaml';
import { fullGraph } from './fixtures';

describe('YAML projection', () => {
  it('round-trips a full graph losslessly', () => {
    const def = fullGraph();
    const yaml = blueprintToYaml(def);
    expect(yamlToBlueprint(yaml)).toEqual(def);
  });

  it('produces plain, human-readable YAML text (not JSON-in-a-string)', () => {
    const yaml = blueprintToYaml(fullGraph());
    expect(yaml).toContain('apiVersion: cariforge.ai/v1alpha1');
    expect(yaml).toContain('nodes:');
  });

  it('rejects a document that fails the blueprint schema', () => {
    expect(() =>
      yamlToBlueprint('apiVersion: cariforge.ai/v1alpha1\nkind: NotAWorkflow\n'),
    ).toThrow();
  });
});
