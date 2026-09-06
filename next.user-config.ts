// @polsia:user-owned — your Next.js customizations, merged into next.config.ts by the
// framework. Edit freely (no slot markers). next.config.ts stays framework-owned: don't
// put security headers / CSP / a full `images` block here.
import type { NextConfig } from 'next';
import type { CspExtraSources } from './src/lib/csp';
import type { AppCapabilities } from './src/lib/permissions-policy';

type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>;

/** Remote hosts you load <Image> from. e.g. { protocol: 'https', hostname: 'images.unsplash.com' } */
export const userRemotePatterns: RemotePatterns = [];

/**
 * Browser capabilities this app needs (drives the Permissions-Policy header).
 * Default: everything OFF — the app cannot even PROMPT for these, so e.g. audio
 * recording never starts. Flip one to `true` to emit `<feature>=(self)`, which
 * lets THIS origin request it; the browser's own permission prompt is still the
 * gate (the user must click Allow). Leave features you don't use OFF — declaring
 * unused device permissions is flagged by security audits.
 *   microphone  → getUserMedia({ audio }), MediaRecorder (voice recording)
 *   camera      → getUserMedia({ video }) (video calls, QR scan, photo)
 *   geolocation → navigator.geolocation ("near me", maps)
 */
export const appCapabilities: AppCapabilities = {
  microphone: false,
  camera: false,
  geolocation: false,
};

/**
 * Extra Content-Security-Policy source allow-lists, appended to the locked base
 * policy (proxy.ts). Default: all EMPTY (same-origin only). List the EXACT
 * third-party origins a feature needs — never a bare `*` (wildcards and
 * script/style execution escapes are dropped). script-src and style-src are
 * intentionally NOT configurable here: the strict script-src is the XSS rampart,
 * locked by tests/unit/csp.test.ts.
 *   frameSrc   → third-party <iframe> (Stripe, YouTube, reCAPTCHA, Calendly, maps)
 *   connectSrc → fetch/XHR/WebSocket/SSE to other origins (Supabase, Sentry, APIs)
 *   mediaSrc   → <audio>/<video> loaded from other origins
 *   fontSrc    → web fonts from other origins (next/font self-hosts, so rare)
 *   imgSrc     → images beyond the base `https:` allowance (rare)
 * e.g. { frameSrc: ['https://js.stripe.com'], connectSrc: ['https://*.supabase.co'] }
 */
export const cspExtraSources: CspExtraSources = {
  frameSrc: [],
  connectSrc: [],
  mediaSrc: [],
  fontSrc: [],
  imgSrc: [],
};

/** Package-level Next options (transpilePackages, experimental.optimizePackageImports, …). */
export const userNextConfig: NextConfig = {
  // 2026-09-06, direct user instruction: embed this exact build under
  // www.cariforge.com/888 (a Vercel rewrite proxying to a dedicated second
  // deployment of this same repo, distinct from the app's own root
  // deployment at cariforge2-0.vercel.app). Env-var-driven so ONLY that
  // dedicated deployment sets NEXT_BASE_PATH=/888 — cariforge2-0.vercel.app
  // itself is unaffected (the var is unset there, basePath stays undefined).
  // Without this, every asset request and internal <Link> navigation
  // escapes the /888 prefix and 404s through the proxy — confirmed live.
  basePath: process.env.NEXT_BASE_PATH || undefined,
  // UX review C3 (wireframe v2): the run-only Approval Desk merged into the
  // unified /approvals inbox. Config-level redirect so old bookmarks get a
  // real 308 instead of a streamed page-level redirect.
  async redirects() {
    return [{ source: '/forge/approvals', destination: '/approvals', permanent: true }];
  },
  // Confirmed as a real bug live 2026-09-06 on the /888 basePath deployment:
  // the framework-owned better-auth client (src/lib/auth-client.ts — DO NOT
  // EDIT) deliberately calls same-origin `/api/auth/*` with NO baseURL/
  // basePath, by design, so ONE build works on every polsia tenant host. But
  // a raw client-side fetch() is never auto-prefixed by Next's basePath
  // (unlike <Link>/router.push), so under this basePath deployment every
  // sign-in/sign-up/get-session call escaped to the bare, unprefixed path —
  // 404 on this app, and through the www.cariforge.com/888 proxy it lands on
  // the marketing site's own project instead. Every login attempt failed
  // with a generic "Could not sign in" no matter the credentials.
  // Fixed at the config layer instead of touching the framework-owned
  // client: catch the bare path and forward it internally to the real,
  // prefixed route. `basePath: false` disables Next's automatic prefixing
  // for BOTH source and destination on this rule, so the hand-written
  // prefix below is taken literally — only active when NEXT_BASE_PATH is
  // set, so the primary multi-tenant deployment (no basePath) is untouched.
  async rewrites() {
    const basePath = process.env.NEXT_BASE_PATH;
    // Next requires a `basePath: false` rewrite's destination to be a full
    // http(s) URL, not a relative path (even one already inside basePath) —
    // confirmed live: a relative "${basePath}/api/auth/:path*" destination
    // is rejected as "outside of the basePath". This deployment's own
    // stable Vercel alias is hardcoded deliberately: this rule only exists
    // when NEXT_BASE_PATH is set, which is true on ONLY this one dedicated
    // deployment, so it can never point at the wrong host.
    if (!basePath) return [];
    return [
      {
        source: '/api/auth/:path*',
        destination: `https://cariforgeplatform-web.vercel.app${basePath}/api/auth/:path*`,
        basePath: false as const,
      },
    ];
  },
};

export type ConfigPlugin = (config: NextConfig) => NextConfig;

/**
 * Next plugins that must WRAP the whole config (next-intl, Sentry, MDX,
 * bundle-analyzer). Each entry is a `(config) => config` wrapper — pre-bind
 * options. next.config.ts applies these and re-asserts the security headers
 * afterward, so a plugin can extend the build but never drop the day-1 posture.
 * For i18n, install the `i18n` module and add its plugin here per its AGENT.md.
 *
 *   export const userConfigPlugins: ConfigPlugin[] = [
 *     createNextIntlPlugin('./src/i18n/request.ts'),
 *     (config) => withSentryConfig(config, { silent: true }),
 *   ];
 */
export const userConfigPlugins: ConfigPlugin[] = [];
