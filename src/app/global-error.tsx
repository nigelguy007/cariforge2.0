// @polsia:user-owned — root error boundary; REPLACES the layout, so it
// renders its own <html>/<body> with inline styles (theme/providers/CSS
// imports unavailable here). Restyled to match the white-emerald Liquid
// Glass system — kept self-contained, no external assets: white-emerald
// background tint derived from the brand hue (152, matching
// src/app/globals.css's brand_tokens seed — computed via OKLCH->sRGB, not
// eyeballed), generous typography, and a glass-tone retry button.

'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: '"Sora", "Manrope", "Inter", ui-sans-serif, system-ui, sans-serif',
          color: '#14301c',
          backgroundColor: '#f3fbf4',
          backgroundImage:
            'radial-gradient(circle at 20% 0%, oklch(0.95 0.05 152 / 0.55), transparent 55%), radial-gradient(circle at 80% 100%, oklch(0.93 0.06 152 / 0.45), transparent 50%)',
          backgroundAttachment: 'fixed',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '0.35rem 0.75rem',
            borderRadius: '999px',
            border: '1px solid oklch(0.52 0.10 152 / 0.35)',
            background: 'oklch(1 0 0 / 0.55)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#14301c',
          }}
        >
          Critical error
        </span>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Something went wrong
        </h1>
        <p
          style={{
            maxWidth: '32rem',
            margin: 0,
            fontSize: '1rem',
            lineHeight: 1.6,
            color: '#455c4a',
          }}
        >
          A critical error occurred above the layout. Reload to retry, or step back to the home page
          to start a new brief.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: '0.25rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid oklch(0.52 0.10 152 / 0.55)',
            background: 'oklch(0.52 0.10 152 / 0.95)',
            color: '#f3fbf4',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
