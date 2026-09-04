// @polsia:user-owned — runs once before the e2e suite. Authenticates both
// QA accounts programmatically (see support/auth.ts) and writes each
// session out as Playwright storageState, so individual specs start already
// signed in instead of re-authenticating every test.

import { request as playwrightRequest } from '@playwright/test';
import { QA_ADMIN, QA_SUBMITTER, signInOrSignUp } from './support/auth';

async function saveSession(baseURL: string, account: typeof QA_SUBMITTER, outFile: string) {
  const request = await playwrightRequest.newContext({ baseURL });
  await signInOrSignUp(request, account);
  await request.storageState({ path: outFile });
  await request.dispose();
}

export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL ?? 'https://cariforge2-0.vercel.app';
  await saveSession(baseURL, QA_SUBMITTER, 'tests/e2e/.auth/submitter.json');
  await saveSession(baseURL, QA_ADMIN, 'tests/e2e/.auth/admin.json');
}
