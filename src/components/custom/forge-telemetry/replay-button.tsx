// @polsia:user-owned — Replay button: re-runs a model/chat usage payload
// through the cost-attribution logic so a tester can preview the HONEST
// marker without mutating database state. Pure derivation preview.

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  blendedCostCents,
  chatCostCents,
  modelUsageCostCents,
} from '@/lib/business/forge/cost-attribution';

interface ReplayResult {
  preview: 'known' | 'unknown';
  totalCents: number;
  hasUnknownCost: boolean;
  lines: Array<{ kind: 'model' | 'chat'; detail: string; costCents: number; unknownCost: boolean }>;
}

export function ReplayButton() {
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [prompt, setPrompt] = useState('1000');
  const [completion, setCompletion] = useState('500');
  const [chatModel, setChatModel] = useState('claude-haiku-4-5-20251001');
  const [chatCount, setChatCount] = useState('25');
  const [result, setResult] = useState<ReplayResult | null>(null);

  const runReplay = () => {
    const promptN = Number(prompt) || 0;
    const completionN = Number(completion) || 0;
    const chatN = Number(chatCount) || 0;
    const modelRes = modelUsageCostCents(model, promptN, completionN);
    const chatRes = chatCostCents(chatModel, chatN);
    const blended = blendedCostCents({
      missionId: 'preview',
      modelRows: [{ model, promptTokens: promptN, completionTokens: completionN }],
      chatRows: [{ model: chatModel, messageCount: chatN }],
    });
    setResult({
      preview: blended.hasUnknownCost ? 'unknown' : 'known',
      totalCents: blended.blendedCents,
      hasUnknownCost: blended.hasUnknownCost,
      lines: [
        {
          kind: 'model',
          detail: `${model}: in=${promptN} out=${completionN}`,
          costCents: modelRes.cents,
          unknownCost: modelRes.unknownCost,
        },
        {
          kind: 'chat',
          detail: `${chatModel}: ${chatN} messages`,
          costCents: chatRes.cents,
          unknownCost: chatRes.unknownCost,
        },
      ],
    });
  };

  return (
    <section className="glass-card rounded-2xl p-6">
      <header>
        <p className="text-eyebrow text-brand-700">Replay (preview only)</p>
        <h2 className="text-h3">Re-run cost attribution</h2>
        <p className="mt-1 text-small text-muted-foreground">
          Pure preview: enter a model + token counts, the helper re-runs the attribution logic
          in-memory so the HONEST marker surfaces without writing to the database.
        </p>
      </header>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-body" htmlFor="replay-model">
          Model
          <input
            id="replay-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body"
          />
        </label>
        <label className="text-body" htmlFor="replay-prompt">
          Prompt tokens
          <input
            id="replay-prompt"
            type="number"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body"
          />
        </label>
        <label className="text-body" htmlFor="replay-completion">
          Completion tokens
          <input
            id="replay-completion"
            type="number"
            value={completion}
            onChange={(e) => setCompletion(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body"
          />
        </label>
        <label className="text-body" htmlFor="replay-chat-model">
          Chat model
          <input
            id="replay-chat-model"
            type="text"
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body"
          />
        </label>
        <label className="text-body" htmlFor="replay-chat-count">
          Chat message count
          <input
            id="replay-chat-count"
            type="number"
            value={chatCount}
            onChange={(e) => setChatCount(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={runReplay} className="glass-cta rounded-full">
          Run replay
        </Button>
      </div>
      {result ? (
        <div className="mt-4">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">
            Preview: {result.preview}
          </p>
          <p className="mt-1 text-h4">${(result.totalCents / 100).toFixed(2)} blended</p>
          {result.hasUnknownCost ? (
            <p className="mt-2 text-caption text-amber-700 dark:text-amber-300">
              Unknown cost surfaced — no estimate fabricated.
            </p>
          ) : null}
          <ul className="mt-3 space-y-1 text-body">
            {result.lines.map((line, idx) => (
              <li key={`${line.kind}-${idx}`} className="flex flex-wrap items-center gap-2">
                <span>
                  <code>{line.kind}</code> — {line.detail}
                </span>
                <span>${(line.costCents / 100).toFixed(2)}</span>
                {line.unknownCost ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-caption text-amber-700 dark:text-amber-300">
                    unknown
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
