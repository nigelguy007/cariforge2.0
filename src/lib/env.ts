//
// Typed env via @t3-oss/env-nextjs.
//
// Modules contribute env vars via their manifest `contributions` block.
// The installer regenerates this file's slots between the markers below.
// Hand-editing outside those slots is rejected by the ownership validator.
//
// The `no-secrets-in-client-bundle` validator scans the build output and rejects
// the install if any non-NEXT_PUBLIC_ env name appears in client chunks.

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // D24: Prisma is the framework-native DB client. DATABASE_URL is
    // injected by Platform at deploy time (D23). The actual Postgres is
    // provisioned by a separate Platform service; this module ships the
    // client only.
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
    // App owner (granted admin on signup); over[email protected]
    OWNER_EMAIL: z.string().default('nigelguy@iyansan.com'),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    // Base for @/lib/api-client + proxy.ts connect-src. Default-empty
    // (unset) means same-origin `/api`; set only for an external API origin.
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    // Modules append NEXT_PUBLIC_* env vars here at install time.
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    OWNER_EMAIL: process.env.OWNER_EMAIL,
  },
  emptyStringAsUndefined: true,
  // SKIP_ENV_VALIDATION=1 bypasses validation for envless builds (lint/CI/local).
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
