// @polsia:user-owned — programmatic auth helper for the e2e suite.
//
// Calls the app's own real better-auth endpoints (POST /api/auth/sign-in/email,
// falling back to /api/auth/sign-up/email the first time an account doesn't
// exist yet) via Playwright's `request` API-testing context — a plain HTTP
// client, not a browser. This is the officially recommended Playwright auth
// pattern: https://playwright.dev/docs/auth#basic-shared-account-in-all-tests.
// No form is ever clicked or filled; the server issues the exact same
// session cookie it would for a real browser login, and that cookie becomes
// each spec's storageState.

import type { APIRequestContext } from '@playwright/test';

export interface QaAccount {
  email: string;
  password: string;
  name: string;
}

// Defaults match the two accounts created 2026-09-04 for this project's own
// QA — override via env if you rotate credentials or add more roles.
export const QA_SUBMITTER: QaAccount = {
  email: process.env.QA_SUBMITTER_EMAIL ?? 'qa-submitter@cariforge.test',
  password: process.env.QA_SUBMITTER_PASSWORD ?? '',
  name: 'QA Submitter',
};

export const QA_ADMIN: QaAccount = {
  email: process.env.QA_ADMIN_EMAIL ?? 'qa-admin@cariforge.test',
  password: process.env.QA_ADMIN_PASSWORD ?? '',
  name: 'QA Admin',
};

/**
 * Signs in as `account`, creating it via real sign-up first if it doesn't
 * exist yet (idempotent — safe to call on a fresh environment or repeatedly
 * against the same one). Returns nothing; the caller reads the session
 * cookie back out of `request.storageState()`.
 */
export async function signInOrSignUp(
  request: APIRequestContext,
  account: QaAccount,
): Promise<void> {
  if (!account.password) {
    throw new Error(
      `No password set for ${account.email} — set QA_SUBMITTER_PASSWORD / QA_ADMIN_PASSWORD in your env. See tests/e2e/README.md.`,
    );
  }
  const signIn = await request.post('/api/auth/sign-in/email', {
    data: { email: account.email, password: account.password },
  });
  if (signIn.ok()) return;

  // First run against a fresh environment: account doesn't exist yet.
  const signUp = await request.post('/api/auth/sign-up/email', {
    data: { name: account.name, email: account.email, password: account.password },
  });
  if (!signUp.ok()) {
    const body = await signUp.text();
    throw new Error(`Could not sign in or sign up ${account.email}: ${signUp.status()} ${body}`);
  }
}
