// @polsia:user-owned — e2e specs for the plain "user" role (QA Submitter).
// Uses the storageState global-setup wrote out — already signed in, no
// login form touched by the test itself.

import { expect, test } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/submitter.json' });

test('dashboard loads for a plain user, not an admin-only surface', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  // Real finding (2026-09-04 first feedback round): a submitter account
  // must NOT see "Admin access" — only owner-bootstrap or promoted accounts
  // should.
  await expect(page.getByText('Admin access')).toHaveCount(0);
  await expect(page.getByText('User access')).toBeVisible();
});

test('forge canvas is reachable and shows the node palette above the fold', async ({ page }) => {
  await page.goto('/forge');
  await expect(page.getByText('Sketch it, then run it')).toBeVisible();
  // Real finding: "what do nodes do?" — the palette's node list, not the
  // Guide box, must be the first thing in the (mobile-capped) palette.
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
});

test('approvals queue shows no tasks for a fresh submitter (own-only scoping)', async ({
  page,
}) => {
  await page.goto('/approvals');
  await expect(page.getByText('You have no approvals waiting')).toBeVisible();
});

test('pipeline detail is reachable once signed in, even for a non-admin', async ({ page }) => {
  await page.goto('/dashboard/pipeline');
  await expect(
    page.getByRole('heading', { name: /full stage, agent, and architecture detail/i }),
  ).toBeVisible();
  // Full operational-boundary toggle should be present here (signed-in
  // view), unlike the public /how-it-works summary.
  await expect(page.getByText('Show operational boundaries').first()).toBeVisible();
});

test('admin-only leads endpoint refuses a plain user', async ({ request }) => {
  const res = await request.get('/api/admin/leads', {
    headers: { cookie: await cookieHeader() },
  });
  expect(res.status()).toBe(403);
});

// Playwright's `request` fixture doesn't automatically reuse the browser
// context's storageState cookies for a bare API call in some setups —
// reading the file directly keeps this assertion self-contained.
async function cookieHeader(): Promise<string> {
  const fs = await import('node:fs/promises');
  const state = JSON.parse(await fs.readFile('tests/e2e/.auth/submitter.json', 'utf-8'));
  return state.cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join('; ');
}

test('dashboard hides the redundant quick-capture box once a brief exists', async ({
  page,
  request,
}) => {
  // Real user feedback (2026-09-04, with a screenshot): "look u can see
  // the two nonsensical your brief and then askign what do you want to
  // build. remove the what do you want to build because u would have
  // added it in the your brief." Self-contained: submits a fresh brief
  // right here rather than depending on leftover state from other test
  // runs, so this passes or fails on its own regardless of run order.
  const res = await request.post('/api/leads', {
    data: {
      brief: `E2E dashboard-dedupe check (${new Date().toISOString()}): a workflow that reads inbound support tickets and routes them by urgency.`,
      email: 'qa-submitter@cariforge.test',
    },
  });
  expect(res.status()).toBe(201);

  await page.goto('/dashboard');
  await expect(page.getByText('Your brief', { exact: false }).first()).toBeVisible();
  // The quick-capture box's own H1 — must not render once a brief covers
  // the same question.
  await expect(page.getByRole('heading', { name: 'What do you want to build?' })).toHaveCount(0);
});
