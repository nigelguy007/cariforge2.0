// @polsia:user-owned — reusable section header. The eyebrow / title / lede
// triplet that the AI-Kit consistently uses. Composition is intentionally
// small — pages can drop it in place of ad-hoc <div> wrappers around a
// title.

import type * as React from 'react';
import { cn } from '@/lib/utils';

interface GlassSectionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  titleClassName?: string;
  ledeClassName?: string;
}

export function GlassSectionHeader({
  eyebrow,
  title,
  lede,
  align = 'left',
  className,
  as = 'h2',
  titleClassName,
  ledeClassName,
}: GlassSectionHeaderProps) {
  const TitleTag = as;
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'items-center text-center' : 'max-w-3xl',
        className,
      )}
    >
      {eyebrow ? <p className="text-eyebrow text-brand-700">{eyebrow}</p> : null}
      <TitleTag
        className={cn('font-display tracking-tight text-foreground text-h2', titleClassName)}
      >
        {title}
      </TitleTag>
      {lede ? <p className={cn('text-body-lg text-foreground/85', ledeClassName)}>{lede}</p> : null}
    </div>
  );
}
