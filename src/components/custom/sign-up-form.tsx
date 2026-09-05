// @polsia:user-owned
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUp } from '@/lib/auth-client';

// Email + password sign-up. Composes the template's base shadcn primitives
// (Button/Input/Label) styled through the theme tokens. Restyle freely — this
// file is user-owned. Calls better-auth's authClient.signUp.email; better-auth
// requires a name field, so we collect one. On success the session cookie is
// set by the catch-all route handler and the page reloads.
export function SignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const { error: signUpError } = await signUp.email({ name, email, password });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? 'Could not create your account. Try again.');
      return;
    }
    // Real user feedback (2026-09-04): "I submitted the brief and gave an
    // email, however when I signed up I cannot see what I submitted and
    // don't see a dashboard link either." Root cause: this redirected to
    // the public marketing homepage (`/`), not the dashboard — a brand-new
    // account landed back on the splash page instead of the page that
    // actually shows the brief they just submitted (BriefConversionCard,
    // on /dashboard, matched by the email they gave either way).
    //
    // "Capture first, chat after signup" (2026-09-05): when this signup was
    // reached from the public brief form's CTA, ?lead= and ?intake= carry
    // the just-submitted brief forward — land straight in the same chat
    // intake (/missions/new) pre-seeded with it, instead of the generic
    // dashboard. Read via window.location.search rather than
    // useSearchParams: this page renders SignUpForm with no Suspense
    // boundary, and useSearchParams would force it into a client-side
    // bailout (see canvas-builder.tsx for the same tradeoff). A normal,
    // non-brief-originated signup (no params) keeps the existing redirect.
    const params = new URLSearchParams(window.location.search);
    const lead = params.get('lead');
    const intake = params.get('intake');
    if (lead && intake) {
      window.location.assign(
        `/missions/new?intake=${encodeURIComponent(intake)}&lead=${encodeURIComponent(lead)}`,
      );
      return;
    }
    window.location.assign('/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <Label htmlFor="sign-up-name">Name</Label>
      <Input
        id="sign-up-name"
        name="name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      <Label htmlFor="sign-up-email">Email address</Label>
      <Input
        id="sign-up-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      <Label htmlFor="sign-up-password">Password</Label>
      <Input
        id="sign-up-password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
