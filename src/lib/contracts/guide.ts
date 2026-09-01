// @polsia:user-owned — shared zod contract for POST /api/forge-canvas/guide
// (PR B, Forge Guide). Same graceful-degradation shape as
// contracts/configurator.ts: the client never special-cases a thrown
// error — even 'unavailable' still carries a compiled, valid, runnable
// draft (the offline fallback graph), just with a banner explaining why.
// `indicative: true` on every response is a standing reminder next to the
// data, not a note the client has to remember to render: this compiled
// graph is a starting point, not a ruling.

import { z } from 'zod';
import { ConfiguratorRequest, ConfiguratorResult } from './configurator';
import { CariBlueprintDefinition } from './forge-canvas';

export const GuideRequest = ConfiguratorRequest;
export type GuideRequestT = z.infer<typeof GuideRequest>;

export const GuideResponse = z.object({
  status: z.enum(['ok', 'unavailable']),
  indicative: z.literal(true),
  // Present only when status === 'ok' — the raw configurator read the
  // graph was compiled from, so the canvas can show the same fit/summary/
  // risk-flags context the front-door configurator does.
  result: ConfiguratorResult.optional(),
  definition: CariBlueprintDefinition,
  suggestedSlug: z.string(),
  suggestedName: z.string(),
});
export type GuideResponseT = z.infer<typeof GuideResponse>;
