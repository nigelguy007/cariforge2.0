// @polsia:user-owned — global navigation rendered from src/lib/nav.ts.

'use client';

import { ChevronDown, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { ThemeToggle } from '@/components/custom/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
// Session seam. better-auth is installed — read the session reactively so
// `requiresAuth: true` nav items (e.g. the admin Leads link) appear after sign-in.
import { useSession } from '@/lib/auth-client';
import { type NavGroup, type NavItem, navItems } from '@/lib/nav';
import { siteName } from '@/lib/site';
import { cn } from '@/lib/utils';

function useIsAuthenticated(): boolean {
  const { data, isPending } = useSession();
  if (isPending) return false;
  return Boolean(data?.user);
}

function visibleItems(group: NavGroup, isAuthenticated: boolean): NavItem[] {
  return navItems
    .filter((item) => item.group === group && (!item.requiresAuth || isAuthenticated))
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.label.localeCompare(b.label),
    );
}

// Inline top-bar slots (a slot = one link OR one `menu` dropdown), capped so the
// bar can't grow wide. Kept here (not a sibling module) so a template upgrade
// re-stamps the whole nav as one user-owned file rather than seeding an orphan.
const MAX_PRIMARY_SLOTS = 5;

type NavSlot =
  | { readonly type: 'link'; readonly item: NavItem }
  | { readonly type: 'menu'; readonly label: string; readonly items: readonly NavItem[] };

const itemOrder = (i: NavItem) => i.order ?? Number.MAX_SAFE_INTEGER;
const slotOrder = (s: NavSlot) =>
  s.type === 'link' ? itemOrder(s.item) : Math.min(...s.items.map(itemOrder));
const slotLabel = (s: NavSlot) => (s.type === 'link' ? s.item.label : s.label);

// Items sharing a `menu` collapse into one dropdown (at their earliest position);
// the rest stay links. Sorts by `order` then label.
function buildPrimarySlots(items: readonly NavItem[]): NavSlot[] {
  const links: NavSlot[] = [];
  const menus = new Map<string, NavItem[]>();
  for (const item of items) {
    if (item.menu) {
      const bucket = menus.get(item.menu);
      if (bucket) bucket.push(item);
      else menus.set(item.menu, [item]);
    } else {
      links.push({ type: 'link', item });
    }
  }
  const menuSlots: NavSlot[] = [...menus].map(([label, its]) => ({
    type: 'menu',
    label,
    items: [...its].sort((a, b) => itemOrder(a) - itemOrder(b) || a.label.localeCompare(b.label)),
  }));
  return [...links, ...menuSlots].sort(
    (a, b) => slotOrder(a) - slotOrder(b) || slotLabel(a).localeCompare(slotLabel(b)),
  );
}

// At most MAX_PRIMARY_SLOTS triggers render; the rest collapse into "More".
function splitPrimarySlots(slots: NavSlot[]): { inline: NavSlot[]; overflow: NavSlot[] } {
  if (slots.length <= MAX_PRIMARY_SLOTS) return { inline: slots, overflow: [] };
  return {
    inline: slots.slice(0, MAX_PRIMARY_SLOTS - 1),
    overflow: slots.slice(MAX_PRIMARY_SLOTS - 1),
  };
}

export function SiteNav() {
  const isAuthenticated = useIsAuthenticated();
  // The brand links home, so drop a redundant '/' item from the rendered links.
  const primary = visibleItems('primary', isAuthenticated).filter((item) => item.href !== '/');
  const secondary = visibleItems('secondary', isAuthenticated);

  // Top-bar slots (links + `menu` dropdowns); `inline` renders, `overflow` → "More".
  const slots = buildPrimarySlots(primary);
  const { inline, overflow } = splitPrimarySlots(slots);
  const collapsedCount = primary.length + secondary.length;

  // Controlled so a drawer link both navigates AND dismisses the overlay; without
  // this the Sheet stays open over the new route after client-side navigation.
  const [open, setOpen] = React.useState(false);

  const pathname = usePathname();
  // Exact match for the root; segment-boundary match for everything else so
  // '/blog' highlights on '/blog/post' but '/' never matches every route.
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  const isSlotActive = (slot: NavSlot) =>
    slot.type === 'link' ? isActive(slot.item.href) : slot.items.some((i) => isActive(i.href));

  // / is a single fixed-viewport page that owns its own complete header/nav
  // (src/app/(setup)/page.tsx + vesper-header.tsx) — this global nav would
  // double up with it and break the page's own no-scroll layout, so it opts
  // out entirely on that one route. All hooks above still run unconditionally
  // (rules of hooks); only the render bails.
  if (pathname === '/') return null;

  return (
    <>
      {/* Keyboard-only skip link — hidden until focused, jumps past the nav
          straight to #main-content. Targets the <main id="main-content"> on
          the pages that opt in; harmless no-op on pages that don't yet. */}
      <a
        href="#main-content"
        className="-translate-y-full sr-only fixed top-2 left-2 z-50 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-small focus:not-sr-only focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 w-full glass-nav">
        <nav
          aria-label="Primary"
          className="mx-auto flex h-14 max-w-screen-xl items-center gap-2 px-4"
        >
          <Link
            href="/"
            className="mr-2 shrink-0 truncate font-display text-base font-semibold tracking-tight text-white"
          >
            <span className="font-display tracking-tight">{siteName}</span>
          </Link>

          {/* Desktop (md+): inline slots — direct links + `menu` dropdowns */}
          <div className="hidden items-center gap-1 md:flex">
            {inline.map((slot) =>
              slot.type === 'link' ? (
                <Button
                  key={slot.item.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-white/90 hover:text-white hover:bg-white/10',
                    isActive(slot.item.href) && 'bg-white/15 text-white',
                  )}
                >
                  <Link
                    href={slot.item.href}
                    aria-current={isActive(slot.item.href) ? 'page' : undefined}
                  >
                    {slot.item.label}
                  </Link>
                </Button>
              ) : (
                <DropdownMenu key={`menu:${slot.label}`}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'text-white/90 hover:text-white hover:bg-white/10',
                        isSlotActive(slot) && 'bg-white/15 text-white',
                      )}
                    >
                      {slot.label}
                      <ChevronDown className="ml-1 size-4 opacity-60" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {slot.items.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          href={item.href}
                          aria-current={isActive(item.href) ? 'page' : undefined}
                        >
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            )}

            {/* Overflow: everything past the cap collapses here so the bar can't grow wide */}
            {overflow.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'text-white/90 hover:text-white hover:bg-white/10',
                      overflow.some(isSlotActive) && 'bg-white/15 text-white',
                    )}
                  >
                    More
                    <ChevronDown className="ml-1 size-4 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflow.map((slot, index) => {
                    // Separate a menu group from its neighbours, but not plain links.
                    const fenced =
                      index > 0 && (slot.type === 'menu' || overflow[index - 1]?.type === 'menu');
                    return (
                      <React.Fragment
                        key={slot.type === 'link' ? slot.item.href : `menu:${slot.label}`}
                      >
                        {fenced && <DropdownMenuSeparator />}
                        {slot.type === 'link' ? (
                          <DropdownMenuItem asChild>
                            <Link
                              href={slot.item.href}
                              aria-current={isActive(slot.item.href) ? 'page' : undefined}
                            >
                              {slot.item.label}
                            </Link>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>{slot.label}</DropdownMenuLabel>
                            {slot.items.map((item) => (
                              <DropdownMenuItem key={item.href} asChild>
                                <Link
                                  href={item.href}
                                  aria-current={isActive(item.href) ? 'page' : undefined}
                                >
                                  {item.label}
                                </Link>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        )}
                      </React.Fragment>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Right cluster: ml-auto pushes it right at every breakpoint */}
          <div className="ml-auto flex items-center gap-1">
            {/* Desktop secondary buttons */}
            <div className="hidden items-center gap-1 md:flex">
              {secondary.map((item) => (
                <Button key={item.href} asChild variant="secondary" size="sm">
                  <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </Button>
              ))}
            </div>

            {/* Always visible */}
            <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />

            {/* Mobile (below md): burger + drawer — only when there's something to collapse */}
            {collapsedCount > 0 && (
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 hover:text-white md:hidden"
                  >
                    <Menu />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  aria-describedby={undefined}
                  // The mobile drawer is the nav's own mobile fallback, so it
                  // deliberately stays the same dark surface as the desktop
                  // nav bar (bg-background would otherwise resolve to the
                  // light page background — this overrides shadcn's default
                  // Sheet background, not a text-color fix).
                  className="flex flex-col border-l border-white/20 bg-[oklch(0.2_0.045_var(--brand-h))] text-white"
                >
                  <SheetHeader>
                    <SheetTitle className="text-left text-white">{siteName}</SheetTitle>
                  </SheetHeader>
                  <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1 overflow-y-auto">
                    {/* All slots, no overflow; a `menu` slot becomes a labeled section. */}
                    {slots.map((slot) =>
                      slot.type === 'link' ? (
                        <Button
                          key={slot.item.href}
                          asChild
                          variant="ghost"
                          className={cn(
                            'w-full justify-start text-white hover:bg-white/10 hover:text-white',
                            isActive(slot.item.href) && 'bg-white/15 text-white',
                          )}
                        >
                          <Link
                            href={slot.item.href}
                            aria-current={isActive(slot.item.href) ? 'page' : undefined}
                            onClick={() => setOpen(false)}
                          >
                            {slot.item.label}
                          </Link>
                        </Button>
                      ) : (
                        <div key={`menu:${slot.label}`} className="flex flex-col gap-1">
                          <p className="px-3 pt-2 text-xs font-medium text-white/70">
                            {slot.label}
                          </p>
                          {slot.items.map((item) => (
                            <Button
                              key={item.href}
                              asChild
                              variant="ghost"
                              className={cn(
                                'w-full justify-start pl-6 text-white hover:bg-white/10 hover:text-white',
                                isActive(item.href) && 'bg-white/15 text-white',
                              )}
                            >
                              <Link
                                href={item.href}
                                aria-current={isActive(item.href) ? 'page' : undefined}
                                onClick={() => setOpen(false)}
                              >
                                {item.label}
                              </Link>
                            </Button>
                          ))}
                        </div>
                      ),
                    )}
                    {secondary.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1 border-t border-white/20 pt-4">
                        {secondary.map((item) => (
                          <Button
                            key={item.href}
                            asChild
                            variant="secondary"
                            className="w-full justify-start"
                          >
                            <Link
                              href={item.href}
                              aria-current={isActive(item.href) ? 'page' : undefined}
                              onClick={() => setOpen(false)}
                            >
                              {item.label}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}

export function SiteFooter() {
  const isAuthenticated = useIsAuthenticated();
  const footer = visibleItems('footer', isAuthenticated);
  const pathname = usePathname();
  // Same reason as SiteNav above: / owns its own complete footer (the
  // three-stat bar), so the global footer opts out on that one route.
  if (footer.length === 0 || pathname === '/') return null;

  return (
    // Unlike the nav bar, the footer sits directly on the (now light) page
    // background rather than its own dark surface, so it uses the ordinary
    // theme tokens instead of the nav's hardcoded white.
    <footer className="border-t border-border">
      <nav
        aria-label="Footer"
        className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-1 px-4 py-6 text-sm"
      >
        {footer.map((item) => (
          <Button
            key={item.href}
            asChild
            variant="link"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>
    </footer>
  );
}
