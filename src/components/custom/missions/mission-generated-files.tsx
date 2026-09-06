// @polsia:user-owned — real user report (2026-09-05): "it says the
// project is completed but i dont see any build or solution .. just a
// plan, nothing at all". The SoftwareBuild step now actually generates
// real files (see ai-draft.ts's draftSoftwareBuildFiles) — this renders
// them: a file-by-file viewer with a copy-to-clipboard button, so the
// generated code is actually visible and usable, not just sitting inside
// a handoff's JSON payload that only the raw admin timeline shows.
'use client';

import { Check, Copy, FileCode2 } from 'lucide-react';
import * as React from 'react';

export interface GeneratedFileT {
  readonly path: string;
  readonly content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can fail (permissions, insecure context) —
          // the file content is still right there to select and copy by
          // hand, so this is a convenience, not the only way to get it.
        }
      }}
      className="app-transition inline-flex items-center gap-1.5 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-2.5 py-1 text-[length:var(--app-caption)] text-[var(--app-text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--app-text)]"
    >
      {copied ? (
        <>
          <Check className="size-3.5" aria-hidden="true" /> Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" aria-hidden="true" /> Copy
        </>
      )}
    </button>
  );
}

/** Best-effort file-extension → language label, cosmetic only (no syntax
 *  highlighting library here — plain <pre> keeps this dependency-free). */
function languageLabel(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const known: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    json: 'JSON',
    md: 'Markdown',
    css: 'CSS',
  };
  return known[ext] ?? 'Text';
}

export function MissionGeneratedFiles({ files }: { files: readonly GeneratedFileT[] }) {
  if (files.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="app-small font-medium text-[var(--app-text)]">
        Generated files ({files.length})
      </p>
      <ul className="space-y-2">
        {files.map((f) => (
          <li
            key={f.path}
            className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)]"
          >
            <details>
              <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <FileCode2
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[var(--app-text-muted)]"
                  />
                  <span className="truncate font-mono app-small text-[var(--app-text)]">
                    {f.path}
                  </span>
                  <span className="app-caption shrink-0 text-[var(--app-text-muted)]">
                    {languageLabel(f.path)}
                  </span>
                </span>
              </summary>
              <div className="border-t border-[var(--app-border)] p-3">
                <div className="mb-2 flex justify-end">
                  <CopyButton text={f.content} />
                </div>
                <pre className="max-h-96 overflow-auto rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] p-3 text-[length:var(--app-caption)] leading-relaxed text-[var(--app-text)]">
                  <code>{f.content}</code>
                </pre>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
