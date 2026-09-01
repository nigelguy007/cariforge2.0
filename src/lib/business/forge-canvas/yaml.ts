// @polsia:user-owned — YAML projection of the canonical CARI Blueprint (PR
// A5). YAML is a projection, never a second source of truth: yamlToBlueprint
// re-validates every parse through CariBlueprintDefinition.parse exactly as
// a JSON body would at any API boundary — there is no YAML-specific
// relaxation of the schema, and a round-trip (blueprintToYaml ->
// yamlToBlueprint) must always reproduce the same definition.
//
// Deliberately no 'server-only' import: the canvas Export/Import toolbar
// controls call these directly in the browser (Export stringifies the
// in-memory draft and triggers a download; Import parses a chosen .yaml
// file before handing the result to toFlow, without ever hitting the
// network) — the GET/POST API routes are a thin wrapper around these same
// two functions for programmatic access.

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  CariBlueprintDefinition,
  type CariBlueprintDefinitionT,
} from '@/lib/contracts/forge-canvas';

export function blueprintToYaml(def: CariBlueprintDefinitionT): string {
  return stringifyYaml(def);
}

export function yamlToBlueprint(source: string): CariBlueprintDefinitionT {
  return CariBlueprintDefinition.parse(parseYaml(source));
}
