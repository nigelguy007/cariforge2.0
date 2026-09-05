// @polsia:user-owned — the actual 3D office scene for mission-office-view.tsx.
// User explicitly rejected the CSS/2D "modern desk" version and asked to
// build the literal 3D-walking-characters thing they referenced
// (thomasarisu.agent-office / pixel-agents): "please do as I said using
// that link i sent you". Both referenced tools turned out to have no
// importable component (confirmed by reading their actual repos, not just
// their marketing pages) and are hardwired to Claude Code's own hook/JSONL
// format — so this is a genuine first-party three.js scene, not an import
// of either project, using the exact real per-stage status this app
// already computed (no fabricated telemetry).
//
// react-three-fiber + drei, client-only (imported via next/dynamic with
// ssr:false from mission-office-view.tsx — three.js touches the DOM/WebGL
// and must never run during SSR). Five simple voxel-style people (boxes,
// not licensed sprites) sit at five desks; the group each belongs to is
// repositioned every frame in useFrame based on real status: pending paces
// near the desk, working sits and types, needs-you stands and steps
// forward, done sits still. Colors are read from this app's own CSS custom
// properties at mount (via a 1x1 canvas readback, since three.js's own
// Color.setStyle can't parse this app's oklch() tokens) so the scene stays
// on-brand and keeps working through theme/dark-mode changes without
// hardcoded hex values drifting out of sync.

'use client';

import { Grid, Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import * as React from 'react';
import * as THREE from 'three';
import type { StageName } from '@/lib/contracts/forge';

export type OfficeNodeStatus = 'done' | 'working' | 'needs-you' | 'pending';

export interface OfficeSceneNode {
  readonly stage: StageName;
  readonly agentName: string;
  readonly status: OfficeNodeStatus;
}

interface OfficeColors {
  readonly accent: string;
  readonly done: string;
  readonly warn: string;
  readonly muted: string;
  readonly floor: string;
  readonly grid: string;
  readonly wall: string;
  readonly desk: string;
}

/** Reads a CSS custom property from an element already inside .app-shell,
 *  so the scoped light/dark token values (not just :root's) are honored. */
function readToken(el: Element, name: string, fallback: string): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

/** Converts ANY valid CSS color string (oklch() included) to an "rgb()"
 *  string three.js's own limited Color parser accepts, by letting the
 *  browser's real CSS color parser do the work via a 1x1 canvas readback. */
function cssColorToRgbString(cssColor: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#888888';
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

function VoxelPerson({ color }: { color: string }) {
  const skin = '#2b2f36';
  return (
    <group>
      <mesh position={[0, 0.98, 0]} castShadow>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.4, 0.46, 0.24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.28, 0.62, 0]} castShadow>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.28, 0.62, 0]} castShadow>
        <boxGeometry args={[0.14, 0.4, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.11, 0.18, 0]} castShadow>
        <boxGeometry args={[0.16, 0.36, 0.18]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0.11, 0.18, 0]} castShadow>
        <boxGeometry args={[0.16, 0.36, 0.18]} />
        <meshStandardMaterial color={skin} />
      </mesh>
    </group>
  );
}

function Desk({ deskColor, accent }: { deskColor: string; accent: string }) {
  const legs: readonly [number, number][] = [
    [-0.38, -0.2],
    [0.38, -0.2],
    [-0.38, 0.2],
    [0.38, 0.2],
  ];
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.06, 0.5]} />
        <meshStandardMaterial color={deskColor} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.2, z]} castShadow>
          <boxGeometry args={[0.05, 0.4, 0.05]} />
          <meshStandardMaterial color={deskColor} />
        </mesh>
      ))}
      <mesh position={[0, 0.63, -0.15]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.36, 0.24, 0.02]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function StatusBadge({ agentName, status }: { agentName: string; status: OfficeNodeStatus }) {
  const icon =
    status === 'working' ? (
      <Loader2 className="size-3 animate-spin text-[var(--app-accent)]" aria-hidden="true" />
    ) : status === 'needs-you' ? (
      <AlertCircle className="size-3 text-amber-600" aria-hidden="true" />
    ) : status === 'done' ? (
      <Check className="size-3 text-emerald-600" aria-hidden="true" />
    ) : null;
  return (
    <div
      className="app-small flex items-center gap-1 rounded-full border px-2 py-0.5 whitespace-nowrap shadow-sm"
      style={{
        background: 'var(--app-surface)',
        borderColor: 'var(--app-border)',
        color: 'var(--app-text)',
      }}
    >
      {icon}
      {agentName}
    </div>
  );
}

function AgentDesk({
  index,
  node,
  selected,
  onSelect,
  colors,
}: {
  index: number;
  node: OfficeSceneNode;
  selected: boolean;
  onSelect: () => void;
  colors: OfficeColors;
}) {
  const personRef = React.useRef<THREE.Group>(null);
  const seatZ = -0.55;
  const standZ = 0.35;

  useFrame((state) => {
    const g = personRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime + index * 0.7;
    if (node.status === 'working') {
      g.position.set(0, Math.sin(t * 4) * 0.02, seatZ);
      g.rotation.y = 0;
    } else if (node.status === 'needs-you') {
      g.position.set(0, 0, standZ);
      g.rotation.y = Math.sin(t * 2) * 0.3;
    } else if (node.status === 'pending') {
      g.position.set(Math.sin(t * 0.8) * 0.2, 0, seatZ + Math.cos(t * 0.8) * 0.06);
      g.rotation.y = Math.sin(t * 0.8) * 0.5;
    } else {
      g.position.set(0, 0, seatZ);
      g.rotation.y = 0;
    }
  });

  const bodyColor =
    node.status === 'done'
      ? colors.done
      : node.status === 'working'
        ? colors.accent
        : node.status === 'needs-you'
          ? colors.warn
          : colors.muted;

  return (
    <>
      <Desk deskColor={colors.desk} accent={colors.accent} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: this <group> is a
          react-three-fiber scene-graph node (rendered to a WebGL canvas), not
          an HTML element — biome's DOM a11y rule doesn't know that R3F's
          intrinsic elements aren't part of the accessibility tree. */}
      <group
        ref={personRef}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <VoxelPerson color={bodyColor} />
        {selected ? (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.32, 0.4, 32]} />
            <meshBasicMaterial color={colors.accent} transparent opacity={0.8} />
          </mesh>
        ) : null}
        <Html position={[0, 1.55, 0]} center distanceFactor={9} occlude>
          <StatusBadge agentName={node.agentName} status={node.status} />
        </Html>
      </group>
    </>
  );
}

export function MissionOfficeScene({
  nodes,
  selectedStage,
  onSelectStage,
}: {
  nodes: readonly OfficeSceneNode[];
  selectedStage: StageName | null;
  onSelectStage: (stage: StageName) => void;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [colors, setColors] = React.useState<OfficeColors | null>(null);

  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setColors({
      accent: cssColorToRgbString(readToken(el, '--app-accent', 'oklch(0.5 0.13 200)')),
      done: cssColorToRgbString('oklch(0.55 0.15 165)'),
      warn: cssColorToRgbString('oklch(0.62 0.17 60)'),
      muted: cssColorToRgbString(readToken(el, '--app-text-muted', 'oklch(0.55 0.02 200)')),
      floor: cssColorToRgbString(readToken(el, '--app-surface', '#f3f5f6')),
      grid: cssColorToRgbString(readToken(el, '--app-border', '#d7dde1')),
      wall: cssColorToRgbString(readToken(el, '--app-surface-muted', '#e7ebee')),
      desk: cssColorToRgbString(readToken(el, '--app-accent-soft', '#cbb994')),
    });
  }, []);

  const spacing = 2.1;
  const roomWidth = nodes.length * spacing + 2;
  const startX = -((nodes.length - 1) * spacing) / 2;

  return (
    <div
      ref={wrapperRef}
      className="h-[420px] w-full overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)]"
    >
      {colors ? (
        <Canvas shadows camera={{ position: [0, 6, 9], fov: 40 }}>
          <color attach="background" args={[colors.floor]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[4, 8, 5]} intensity={1} castShadow />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[roomWidth, 5]} />
            <meshStandardMaterial color={colors.floor} />
          </mesh>
          <Grid
            args={[roomWidth, 5]}
            position={[0, 0.001, 0]}
            cellSize={0.5}
            cellColor={colors.grid}
            sectionColor={colors.grid}
            fadeDistance={16}
            infiniteGrid={false}
          />
          <mesh position={[0, 1.1, -1.8]}>
            <planeGeometry args={[roomWidth, 2.2]} />
            <meshStandardMaterial color={colors.wall} side={THREE.DoubleSide} />
          </mesh>
          {nodes.map((node, i) => (
            <group key={node.stage} position={[startX + i * spacing, 0, -1.1]}>
              <AgentDesk
                index={i}
                node={node}
                selected={node.stage === selectedStage}
                onSelect={() => onSelectStage(node.stage)}
                colors={colors}
              />
            </group>
          ))}
          <OrbitControls
            target={[0, 0.8, -0.6]}
            minDistance={5}
            maxDistance={15}
            maxPolarAngle={Math.PI / 2.15}
          />
        </Canvas>
      ) : null}
    </div>
  );
}
