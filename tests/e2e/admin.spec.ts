// @polsia:user-owned — e2e specs for the admin role (QA Admin, promoted via
// a one-time Supabase SQL update after real sign-up — see tests/e2e/README.md).

import { expect, test } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

test('dashboard shows Admin access for a promoted account', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('Admin access')).toBeVisible();
});

test('approvals desk labels tasks that belong to someone else', async ({ page }) => {
  await page.goto('/approvals');
  // Real finding (2026-09-04 first round): "I see run decisions then I see
  // code?? When I click run I see judge demo - why???" Root cause was
  // listTasks() showing every task system-wide to an admin with no label.
  // An admin session should see pre-existing demo/QA runs explicitly marked
  // "Not yours" rather than looking like broken or unexplained data.
  await expect(page.getByText('Not yours').first()).toBeVisible();
});

test('admin can reach the leads list the public/submitter role cannot', async ({ request }) => {
  const res = await request.get('/api/admin/leads', { headers: { cookie: await cookieHeader() } });
  expect(res.status()).toBe(200);
});

test('agents API returns full operational-boundary detail once authenticated', async ({
  request,
}) => {
  const res = await request.get('/api/agents', { headers: { cookie: await cookieHeader() } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.items[0].boundary).toBeDefined();
  expect(body.items[0].boundary.inputs.length).toBeGreaterThan(0);
});

async function cookieHeader(): Promise<string> {
  const fs = await import('node:fs/promises');
  const state = JSON.parse(await fs.readFile('tests/e2e/.auth/admin.json', 'utf-8'));
  return state.cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join('; ');
}
