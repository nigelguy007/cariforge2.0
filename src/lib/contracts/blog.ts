// @polsia:user-owned — shared zod contract for the Blog resource. Read-only
// editor content surfaced on /blog — title, one-line hook, ISO date, topic
// tag. One source of truth shared between the GET /api/blog handler (server)
// and the <BlogIndex/> island (client). Keep client-importable: zod only,
// no server-only imports.

import { z } from 'zod';

export const BlogPost = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string().min(1),
  hook: z.string().min(1),
  date: z.string().min(1),
  topic: z.string().min(1),
  /** Optional "Read also" link rendered on the post card. Null when the post
   *  has no companion page; a non-empty path string when it does (e.g. the
   *  audit-checklist post surfaces the worked example at /sample-brief). */
  relatedHref: z.string().min(1).nullable(),
  relatedLabel: z.string().min(1).nullable(),
});

export const BlogList = z.object({
  items: z.array(BlogPost),
});

export type BlogPost = z.infer<typeof BlogPost>;
export type BlogList = z.infer<typeof BlogList>;
