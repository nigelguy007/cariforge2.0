// @polsia:user-owned — app 404 page. Restyled to match the white-emerald
// Liquid Glass system: aurora backdrop, centered glass card, large
// numeric headline with an eyebrow chip explaining what went wrong, and
// a primary CTA back to the home page's brief intake.

import Link from 'next/link';
import { GlassCard, GlassChip } from '@/components/custom/glass';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-aurora" />
      <GlassCard
        tone="surface"
        padding="lg"
        backdrop="soft"
        className="relative z-10 flex w-full max-w-xl flex-col items-center gap-4 text-center"
      >
        <GlassChip tone="muted" size="sm" className="self-center">
          Page not found
        </GlassChip>
        <p className="font-display text-display tracking-tight text-foreground">404</p>
        <h1 className="font-display text-h2 tracking-tight text-foreground">
          That route is not on file.
        </h1>
        <p className="max-w-md text-body leading-relaxed text-muted-foreground">
          The page you tried to open does not exist — either it has been retired, or the URL was
          mistyped. The council still has open seats; step back to the home page and leave a brief.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button asChild size="lg">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild type="button" variant="outline" size="lg">
            <Link href="/how-the-council-works">How the council works</Link>
          </Button>
        </div>
      </GlassCard>
    </main>
  );
}
