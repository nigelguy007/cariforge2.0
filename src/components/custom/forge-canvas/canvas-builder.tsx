// @polsia:user-owned — Forge Canvas builder (Agent Builder Release 1).
// Kore.ai-inspired layout, original implementation: left node palette,
// centre zoomable canvas, right configuration inspector, top toolbar
// (name, validate, save, run), bottom validation panel. The canvas is a
// projection of the canonical CARI Blueprint — save serialises back to it
// (handover §13), so canvas and blueprint can never drift.
//
// Accessibility (handover §10): every palette entry is a real button
// (click adds the node — the keyboard alternative to drag), all controls
// are labelled, validation issues are text on the affected node, never a
// colour change alone.

'use client';

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Redo2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  BlueprintItem,
  type BlueprintItemT,
  BlueprintList,
  BlueprintValidation,
  type BlueprintValidationT,
  CanvasAgentList,
  type CanvasAgentItemT,
  type CanvasNodeT,
  type CanvasNodeType,
  CanvasRunDetail,
  type CariBlueprintDefinitionT,
} from '@/lib/contracts/forge-canvas';
import { ForgeCanvasNode, type ForgeNodeData } from './canvas-node';

type FlowNode = Node<ForgeNodeData>;

const nodeTypes = { forge: ForgeCanvasNode };

const PALETTE: { type: CanvasNodeType; label: string; hint: string }[] = [
  { type: 'start', label: 'Start', hint: 'Where every run begins — one per workflow.' },
  { type: 'agent', label: 'Agent', hint: 'A registry agent does a bounded piece of work.' },
  { type: 'condition', label: 'Condition', hint: 'Deterministic branch — no model decides this.' },
  { type: 'approval', label: 'Human approval', hint: 'Pauses the run for a named decision.' },
  { type: 'end', label: 'End', hint: 'Where a run finishes.' },
];

function defaultConfig(type: CanvasNodeType): CanvasNodeT['config'] {
  switch (type) {
    case 'start':
      return { inputDescription: '' };
    case 'agent':
      return { agentSlug: '' };
    case 'condition':
      return { sourceNodeId: '', contains: '' };
    case 'approval':
      return { title: 'Approve to continue' };
    case 'end':
      return {};
  }
}

function toFlow(def: CariBlueprintDefinitionT): { nodes: FlowNode[]; edges: Edge[] } {
  return {
    nodes: def.nodes.map((n) => ({
      id: n.id,
      type: 'forge',
      position: n.position,
      data: { label: n.label, nodeType: n.type, config: n.config } as ForgeNodeData & {
        config: CanvasNodeT['config'];
      },
    })),
    edges: def.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      ...(e.branch ? { sourceHandle: e.branch, label: e.branch === 'true' ? 'True' : 'False' } : {}),
    })),
  };
}

function toBlueprint(
  nodes: FlowNode[],
  edges: Edge[],
  objective: string,
): CariBlueprintDefinitionT {
  return {
    apiVersion: 'cariforge.ai/v1alpha1',
    kind: 'AgentWorkflow',
    objective,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      label: n.data.label,
      config: (n.data as { config?: object }).config ?? defaultConfig(n.data.nodeType),
    })) as CariBlueprintDefinitionT['nodes'],
    edges: edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      ...(e.sourceHandle === 'true' || e.sourceHandle === 'false'
        ? { branch: e.sourceHandle }
        : {}),
    })),
  };
}

export function ForgeCanvasBuilder() {
  const router = useRouter();
  const [nodes, setNodes] = React.useState<FlowNode[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [name, setName] = React.useState('My first workflow');
  const [slug, setSlug] = React.useState('my-first-workflow');
  const [agents, setAgents] = React.useState<CanvasAgentItemT[]>([]);
  const [saved, setSaved] = React.useState<{ slug: string; version: number }[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [issues, setIssues] = React.useState<BlueprintValidationT['issues']>([]);
  const [runInput, setRunInput] = React.useState('');
  const [busy, setBusy] = React.useState<'save' | 'run' | 'validate' | null>(null);
  // UX review C2: when the loaded blueprint was created from a mission,
  // the toolbar links back to it — the canvas stops floating disconnected
  // from the pipeline that spawned it.
  const [missionLink, setMissionLink] = React.useState<{ slug: string; name: string } | null>(
    null,
  );
  const counter = React.useRef(1);

  // Bounded undo/redo history (acceptance: "Undo, redo and keyboard
  // alternatives work") — snapshots of nodes+edges, capped at 50.
  const past = React.useRef<{ nodes: FlowNode[]; edges: Edge[] }[]>([]);
  const future = React.useRef<{ nodes: FlowNode[]; edges: Edge[] }[]>([]);
  const snapshot = React.useCallback(() => {
    past.current = [...past.current.slice(-49), { nodes, edges }];
    future.current = [];
  }, [nodes, edges]);
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ nodes, edges });
    setNodes(prev.nodes);
    setEdges(prev.edges);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ nodes, edges });
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  React.useEffect(() => {
    apiFetch('/api/forge-canvas/agents', { schema: CanvasAgentList })
      .then((r) => setAgents(r.items))
      .catch(() => toast.error('Could not load the agent registry.'));
    apiFetch('/api/forge-canvas/blueprints', { schema: BlueprintList })
      .then((r) => setSaved(r.items.map((i) => ({ slug: i.slug, version: i.version }))))
      .catch(() => {});
  }, []);

  // UX review C2: /forge?slug=<x> deep-links straight into a blueprint —
  // this is how "Open in Forge Canvas" on a mission's Build panel lands
  // here with the right workflow already loaded. window.location (not
  // useSearchParams) keeps this client island prerender-safe.
  React.useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('slug');
    if (wanted) void load(wanted);
    // load is a stable closure over setters — run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNode = (type: CanvasNodeType) => {
    snapshot();
    const id = `${type}-${counter.current++}`;
    const paletteEntry = PALETTE.find((p) => p.type === type);
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'forge',
        position: { x: 120 + ns.length * 40, y: 100 + ns.length * 30 },
        data: {
          label: paletteEntry?.label ?? type,
          nodeType: type,
          config: defaultConfig(type),
        } as ForgeNodeData,
      },
    ]);
    setSelectedId(id);
  };

  const onNodesChange = React.useCallback(
    (changes: NodeChange<FlowNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );
  const onEdgesChange = React.useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [],
  );
  const onConnect = React.useCallback(
    (conn: Connection) => {
      snapshot();
      setEdges((es) =>
        addEdge(
          {
            ...conn,
            id: `e-${conn.source}-${conn.sourceHandle ?? 'out'}-${conn.target}`,
            ...(conn.sourceHandle === 'true' || conn.sourceHandle === 'false'
              ? { label: conn.sourceHandle === 'true' ? 'True' : 'False' }
              : {}),
          },
          es,
        ),
      );
    },
    [snapshot],
  );

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const updateSelected = (patch: Partial<ForgeNodeData> & { config?: object }) => {
    if (!selected) return;
    setNodes((ns) =>
      ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  const currentDefinition = () => toBlueprint(nodes, edges, name);

  const applyIssues = (list: BlueprintValidationT['issues']) => {
    setIssues(list);
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        data: { ...n.data, issue: list.find((i) => i.nodeId === n.id)?.message },
      })),
    );
  };

  const validate = async () => {
    setBusy('validate');
    try {
      const res = await apiFetch(`/api/forge-canvas/blueprints/${slug}/validate`, {
        method: 'POST',
        body: JSON.stringify(currentDefinition()),
        schema: BlueprintValidation,
      });
      applyIssues(res.issues);
      if (res.ok) toast.success('Blueprint is valid.');
      return res.ok;
    } catch {
      toast.error('Validation request failed.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      const savedBp = await apiFetch('/api/forge-canvas/blueprints', {
        method: 'POST',
        body: JSON.stringify({ slug, name, definition: currentDefinition() }),
        schema: BlueprintItem,
      });
      applyIssues([]);
      setSaved((s) => [
        { slug: savedBp.slug, version: savedBp.version },
        ...s.filter((x) => x.slug !== savedBp.slug),
      ]);
      toast.success(`Saved ${savedBp.slug} v${savedBp.version}`);
    } catch (err) {
      const cause = (err as { cause?: { issues?: BlueprintValidationT['issues'] } }).cause;
      if (cause?.issues) {
        applyIssues(cause.issues);
        toast.error('Fix the validation issues before saving.');
      } else {
        toast.error('Could not save the blueprint.');
      }
    } finally {
      setBusy(null);
    }
  };

  const load = async (loadSlug: string) => {
    try {
      const bp: BlueprintItemT = await apiFetch(`/api/forge-canvas/blueprints/${loadSlug}`, {
        schema: BlueprintItem,
      });
      const flow = toFlow(bp.definition);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setName(bp.name);
      setSlug(bp.slug);
      setMissionLink(
        bp.missionSlug ? { slug: bp.missionSlug, name: bp.missionName ?? bp.missionSlug } : null,
      );
      applyIssues([]);
      past.current = [];
      future.current = [];
      toast.success(`Loaded ${bp.slug} v${bp.version}`);
    } catch {
      toast.error('Could not load that blueprint.');
    }
  };

  const run = async () => {
    setBusy('run');
    try {
      // A run always executes a SAVED version — save first so the run
      // provably references an immutable blueprint version.
      const savedBp = await apiFetch('/api/forge-canvas/blueprints', {
        method: 'POST',
        body: JSON.stringify({ slug, name, definition: currentDefinition() }),
        schema: BlueprintItem,
      });
      const detail = await apiFetch('/api/forge-canvas/runs', {
        method: 'POST',
        body: JSON.stringify({ slug: savedBp.slug, version: savedBp.version, input: runInput }),
        schema: CanvasRunDetail,
      });
      router.push(`/forge/runs/${detail.id}`);
    } catch (err) {
      const cause = (err as { cause?: { issues?: BlueprintValidationT['issues'] } }).cause;
      if (cause?.issues) {
        applyIssues(cause.issues);
        toast.error('Fix the validation issues before running.');
      } else {
        toast.error('Could not start the test run.');
      }
    } finally {
      setBusy(null);
    }
  };

  const selectedConfig = (selected?.data as { config?: Record<string, unknown> })?.config ?? {};

  return (
    // Fixed viewport-relative height only applies from md up (where the
    // 3 panels sit side by side and share that height); stacked on
    // mobile the page should grow naturally with its content instead of
    // clipping the inspector/palette off the bottom of a fixed box.
    <div className="flex min-h-[540px] flex-col gap-3 md:h-[calc(100dvh-8rem)]">
      {/* Toolbar — real mobile bug found in QA: fixed-width (w-56/w-44)
          inputs inside a non-wrapping flex row forced ~400px of minimum
          content width regardless of viewport, causing horizontal scroll
          on a 390px phone. Full-width + wrapping below sm, fixed width
          from sm up. */}
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-xl p-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Label htmlFor="bp-name" className="sr-only">
            Workflow name
          </Label>
          <Input
            id="bp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-full sm:w-56"
            aria-label="Workflow name"
          />
          <Label htmlFor="bp-slug" className="sr-only">
            Workflow slug
          </Label>
          <Input
            id="bp-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="h-9 w-full font-mono text-xs sm:w-44"
            aria-label="Workflow slug"
          />
          {/* UX review C2: mission-linked blueprints carry a way back to
              the mission that spawned them. */}
          {missionLink ? (
            <a
              href={`/missions/${missionLink.slug}`}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-brand-300/60 bg-brand-50 px-3 text-xs text-brand-700 hover:underline"
              title={`This blueprint belongs to mission "${missionLink.name}"`}
            >
              Mission: {missionLink.name} →
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={undo} aria-label="Undo">
            <Undo2 />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={redo} aria-label="Redo">
            <Redo2 />
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {saved.length > 0 && (
            <Select onValueChange={load}>
              <SelectTrigger className="h-9 w-48" aria-label="Load a saved workflow">
                <SelectValue placeholder="Load saved…" />
              </SelectTrigger>
              <SelectContent>
                {saved.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {s.slug} (v{s.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="button" variant="secondary" onClick={validate} disabled={busy !== null}>
            {busy === 'validate' ? 'Validating…' : 'Validate'}
          </Button>
          <Button type="button" variant="secondary" onClick={save} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save version'}
          </Button>
          <Button type="button" className="glass-cta" onClick={run} disabled={busy !== null}>
            {busy === 'run' ? 'Starting…' : 'Save & test run'}
          </Button>
        </div>
      </div>

      {/* Real mobile bug found in QA: three fixed-width panels side by
          side (palette 208px + inspector 256px + canvas) has no chance of
          fitting a phone viewport. Stacks to a single column below md;
          palette/inspector get a bounded height on mobile so the canvas
          itself stays usable rather than being squeezed to nothing. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        {/* Palette */}
        <aside className="glass-panel max-h-56 w-full shrink-0 space-y-2 overflow-y-auto rounded-xl p-3 md:h-auto md:max-h-none md:w-52">
          <p className="text-eyebrow text-brand-700">Nodes</p>
          {PALETTE.map((p) => (
            <button
              key={p.type}
              type="button"
              onClick={() => addNode(p.type)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-brand-400"
            >
              <span className="block text-sm font-medium text-foreground">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.hint}</span>
            </button>
          ))}
          <div className="space-y-1 pt-2">
            <Label htmlFor="run-input" className="text-xs">
              Test-run input
            </Label>
            <Textarea
              id="run-input"
              rows={3}
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              className="text-xs"
            />
          </div>
        </aside>

        {/* Canvas — explicit min-height on mobile: in a column flex
            layout, flex-1 alone can collapse toward 0 next to two
            content-sized siblings. */}
        <div className="glass-panel min-h-[360px] min-w-0 flex-1 overflow-hidden rounded-xl">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            onNodeDragStart={snapshot}
            fitView
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={20} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>

        {/* Inspector */}
        <aside className="glass-panel max-h-56 w-full shrink-0 space-y-3 overflow-y-auto rounded-xl p-3 md:h-auto md:max-h-none md:w-64">
          <p className="text-eyebrow text-brand-700">Inspector</p>
          {!selected ? (
            <p className="text-xs text-muted-foreground">
              Select a node to configure it. Click a palette entry to add one.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="node-label" className="text-xs">
                  Label
                </Label>
                <Input
                  id="node-label"
                  value={selected.data.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              {selected.data.nodeType === 'agent' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Agent from the registry</Label>
                  <Select
                    value={(selectedConfig['agentSlug'] as string) || undefined}
                    onValueChange={(v) => updateSelected({ config: { agentSlug: v } })}
                  >
                    <SelectTrigger className="h-8 text-sm" aria-label="Agent">
                      <SelectValue placeholder="Pick an agent…" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.slug} value={a.slug}>
                          {a.name} · {a.riskClass}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {agents.length === 0 && (
                    <p className="text-xs text-muted-foreground">Registry is empty.</p>
                  )}
                </div>
              )}
              {selected.data.nodeType === 'condition' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Read the output of</Label>
                    <Select
                      value={(selectedConfig['sourceNodeId'] as string) || undefined}
                      onValueChange={(v) =>
                        updateSelected({ config: { ...selectedConfig, sourceNodeId: v } })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm" aria-label="Source node">
                        <SelectValue placeholder="Pick a node…" />
                      </SelectTrigger>
                      <SelectContent>
                        {nodes
                          .filter((n) => n.id !== selected.id)
                          .map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.data.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="node-contains" className="text-xs">
                      True when output contains
                    </Label>
                    <Input
                      id="node-contains"
                      value={(selectedConfig['contains'] as string) ?? ''}
                      onChange={(e) =>
                        updateSelected({ config: { ...selectedConfig, contains: e.target.value } })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </>
              )}
              {selected.data.nodeType === 'approval' && (
                <div className="space-y-1.5">
                  <Label htmlFor="node-approval-title" className="text-xs">
                    Approval task title
                  </Label>
                  <Input
                    id="node-approval-title"
                    value={(selectedConfig['title'] as string) ?? ''}
                    onChange={(e) => updateSelected({ config: { title: e.target.value } })}
                    className="h-8 text-sm"
                  />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  snapshot();
                  setNodes((ns) => ns.filter((n) => n.id !== selected.id));
                  setEdges((es) =>
                    es.filter((e) => e.source !== selected.id && e.target !== selected.id),
                  );
                  setSelectedId(null);
                }}
              >
                Delete node
              </Button>
            </div>
          )}
        </aside>
      </div>

      {/* Validation panel */}
      {issues.length > 0 && (
        <div className="glass-card rounded-xl p-3">
          <p className="text-small font-medium text-destructive">
            {issues.length} validation issue{issues.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
            {issues.map((i, idx) => (
              <li key={idx}>
                {i.nodeId ? `${i.nodeId}: ` : ''}
                {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
