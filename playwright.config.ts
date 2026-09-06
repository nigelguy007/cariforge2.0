// @polsia:user-owned — Playwright config for the authenticated e2e suite.
//
// Added 2026-09-04 (real user request: "QA the development after log in.
// It can't just be me... find a skill to do this type of testing behind a
// log in"). This is a SEPARATE test track from `vitest` (unit tests, no
// browser, no network) — run explicitly via `npm run test:e2e`, never as
// part of `npm run build` or `npm test`, so it can't affect a Vercel deploy.
//
// Auth is programmatic, not browser-driven: tests/e2e/global-setup.ts signs
// in (or signs up, first run) two QA accounts via the real production
// GET /api/auth/... endpoints — the same code path a real user's browser
// hits — and saves each session as Playwright "storage state" (a cookie
// jar file). Spec files load that storage state instead of clicking through
// a login form every test. This is the standard Playwright auth pattern
// (https://playwright.dev/docs/auth), not a bypass of the app's real
// session/role checks — every request in every spec still carries a real,
// server-issued session cookie and gets the exact role-based response the
// app would give any other browser.
//
// See tests/e2e/README.md for the two QA accounts' credentials and one-time
// local setup (`npx playwright install chromium`).

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'https://cariforge2-0.vercel.app';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.output',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
