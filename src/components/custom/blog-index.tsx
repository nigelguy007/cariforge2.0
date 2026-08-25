// @polsia:user-owned — /blog client island. Loads the editor-cards from
// /api/blog through apiFetch + the shared BlogList contract, then renders a
// responsive grid (one card per post — topic Badge, title, one-line hook,
// formatted date). Loading / empty / error guards mirror the
// pricing-tiers / faq-accordion pattern.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GlassCard, GlassChip } from '@/components/custom/glass';
import { apiFetch } from '@/lib/api-client';
import { BlogList, type BlogList as BlogListType } from '@/lib/contracts/blog';

type Post = BlogListType['items'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function parseDate(iso: string): Date | null {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function PostCard({ post }: { post: Post }) {
  const parsed = parseDate(post.date);
  const formatted = parsed ? dateFormatter.format(parsed) : post.date;

  return (
    <GlassCard tone="surface" padding="lg" interactive className="h-full">
      <GlassChip tone="brand" size="sm" className="self-start">
        {post.topic}
      </GlassChip>
      <h3 className="mt-3 font-display text-h3 tracking-tight text-foreground">{post.title}</h3>
      <p className="text-body italic text-card-foreground/80">{post.hook}</p>
      <div className="mt-auto flex flex-col gap-3 pt-3">
        <time
          dateTime={post.date}
          className="font-display text-caption tracking-[0.06em] text-muted-foreground"
        >
          {formatted}
        </time>
        {post.relatedHref && post.relatedLabel && (
          <Link href={post.relatedHref} className="link-brand text-small">
            {post.relatedLabel} →
          </Link>
        )}
      </div>
    </GlassCard>
  );
}

function SkeletonCard() {
  return (
    <GlassCard tone="surface" padding="lg" className="h-full">
      <div className="h-5 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-6 w-4/5 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-11/12 animate-pulse rounded bg-muted" />
      <div className="mt-auto pt-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    </GlassCard>
  );
}

export function BlogIndex() {
  const [items, setItems] = useState<Post[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/blog', { schema: BlogList })
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the blog.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <GlassCard tone="surface" padding="md">
        <p className="text-small text-destructive">{loadError}</p>
      </GlassCard>
    );
  }

  const list = items ?? [];
  const isLoading = items === null;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {isLoading
        ? [0, 1, 2].map((slot) => <SkeletonCard key={slot} />)
        : list.map((post) => <PostCard key={post.id} post={post} />)}
      {!isLoading && list.length === 0 && (
        <p className="col-span-full text-small text-muted-foreground">No posts published yet.</p>
      )}
    </div>
  );
}
