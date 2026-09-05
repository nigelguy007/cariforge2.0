// @polsia:user-owned — the actual "Office" visualization for
// mission-office-view.tsx, round 4 (2026-09-05). Full history: user asked
// for "people in an office 3D looking" and pointed at
// github.com/pixel-agents-hq/pixel-agents, then at the VS Code extension
// thomasarisu.agent-office (a three.js voxel office) — both confirmed by
// reading their actual repos to be standalone webview/servers watching
// ONE live Claude Code terminal's hook/JSONL events, with no importable
// component, so neither was something to import. A CSS-only flat "modern
// desk" attempt was rejected ("you are not doing as i expected"), so a
// genuine react-three-fiber 3D scene was built next — and THAT was also
// rejected: "can you make them liik like people who walk from desk to
// desk in an office room and not look 3d?" Clarified directly: side view,
// "want to see the people then see them walk". This is that — a flat
// Canvas 2D side-view office (a floor line, desks left to right, simple
// human silhouettes drawn from primitives, no licensed art), where each
// real agent's character actually walks — a continuously interpolated x
// position, not a CSS wobble or a 3D transform — driven by the exact same
// per-stage status the earlier attempts used (no fabricated telemetry;
// nothing here is a second source of truth).
//
// Design note on "walk from desk to desk": the real pipeline models 5
// distinct agents each owning one stage, not one worker rotating through
// 5 jobs — so rather than inventing a single roaming character that
// doesn't match how the system actually works, each agent walks within
// and around its OWN station: pacing near the desk while pending, walking
// in to sit down once it starts working, walking a few steps out from the
// desk and turning to face the viewer when a stage needs a human
// decision. The walking is real (continuous position interpolation +
// animated legs), it's just scoped to what's true of the data.
//
// Plain Canvas 2D (not WebGL) — this is the same rendering technology
// pixel-agents itself uses, minus its licensed sprite art. Runs entirely
// client-side; unlike the WebGL scene this replaced, canvas 2D has no
// meaningful "unsupported browser" case worth guarding, so there's no
// separate fallback UI. `prefers-reduced-motion` is still respected: the
// animation loop is skipped entirely and each character is drawn once in
// its resolved resting pose. Canvas content is not screen-reader
// accessible, so a visually-hidden button per agent (real DOM, real
// click handler) sits alongside it for keyboard/assistive-tech parity —
// the canvas is `aria-hidden`.

'use client';

import * as React from 'react';
import type { StageName } from '@/lib/contracts/forge';

export type OfficeNodeStatus = 'done' | 'working' | 'needs-you' | 'pending';

export interface OfficeSceneNode {
  readonly stage: StageName;
  readonly agentName: string;
  readonly status: OfficeNodeStatus;
}

function statusLabel(status: OfficeNodeStatus): string {
  switch (status) {
    case 'done':
      return 'Done';
    case 'working':
      return 'Working…';
    case 'needs-you':
      return 'Needs you';
    case 'pending':
      return 'Not started';
  }
}

interface OfficeColors {
  readonly accent: string;
  readonly done: string;
  readonly warn: string;
  readonly muted: string;
  readonly floor: string;
  readonly wall: string;
  readonly deskWood: string;
  readonly text: string;
  readonly textMuted: string;
  readonly skin: string;
  readonly outline: string;
}

/** Reads a CSS custom property already resolved for an element inside
 *  .app-shell, so scoped light/dark token values (not just :root's) are
 *  honored, then hands it straight to canvas — canvas 2D fillStyle
 *  accepts any valid CSS color string directly, oklch() included, unlike
 *  three.js's own limited Color parser. */
function readToken(el: Element, name: string, fallback: string): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

interface CharacterState {
  x: number;
  targetX: number;
  facing: 1 | -1;
  walkPhase: number;
  patrolDir: 1 | -1;
}

const HEAD_R = 13;
const TORSO_W = 24;
const TORSO_H = 42;
const LEG_LEN = 32;
const ARM_LEN = 26;
const STAND_HEIGHT = HEAD_R * 2 + TORSO_H + LEG_LEN;
const WALK_SPEED = 46; // px/sec
const ARRIVE_EPSILON = 1.5;
const PATROL_RANGE = 34;
const STEP_OUT_OFFSET = 46;

/** Where a character rests for a given status, relative to its own desk
 *  center (deskX). Patrol targets are handled separately each tick. */
function restOffsetFor(status: OfficeNodeStatus): number {
  return status === 'needs-you' ? STEP_OUT_OFFSET : 0;
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, floorY: number, colors: OfficeColors) {
  const w = 88;
  const h = 6;
  const legH = 30;
  const topY = floorY - legH;
  ctx.fillStyle = colors.deskWood;
  ctx.fillRect(x - w / 2, topY - h, w, h);
  ctx.fillRect(x - w / 2 + 4, topY, 4, legH);
  ctx.fillRect(x + w / 2 - 8, topY, 4, legH);
  // Monitor
  ctx.fillStyle = colors.outline;
  ctx.fillRect(x - 14, topY - h - 22, 28, 18);
  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(x - 11, topY - h - 19, 22, 12);
  ctx.globalAlpha = 1;
}

/** Draws one flat, side-view or front-view human figure from primitives.
 *  `stride` in [-1,1] drives the walk cycle (leg/arm swing); 0 = idle
 *  standing. `seated` draws a bent-leg seated pose instead. `frontFacing`
 *  draws a symmetric front view (used for the "needs you" wave) instead
 *  of the side profile used while walking. */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    floorY: number;
    facing: 1 | -1;
    stride: number;
    seated: boolean;
    frontFacing: boolean;
    wave: number;
    bodyColor: string;
    colors: OfficeColors;
  },
) {
  const { x, floorY, facing, stride, seated, frontFacing, wave, bodyColor, colors } = opts;
  const headCy = floorY - STAND_HEIGHT + HEAD_R + (seated ? 10 : 0);
  const torsoTop = headCy + HEAD_R;
  const torsoBottom = torsoTop + TORSO_H;
  const hipY = seated ? torsoBottom - 6 : torsoBottom;

  ctx.save();
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  if (seated) {
    // Bent legs tucked toward the desk, feet resting on the floor.
    const footX = x + facing * 14;
    ctx.beginPath();
    ctx.moveTo(x - facing * 4, hipY);
    ctx.lineTo(x + facing * 6, hipY + 16);
    ctx.lineTo(footX, floorY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - facing * 4, hipY);
    ctx.lineTo(x + facing * 2, hipY + 18);
    ctx.lineTo(footX - facing * 6, floorY);
    ctx.stroke();
  } else if (frontFacing) {
    const legSwing = Math.sin(stride) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 6, hipY);
    ctx.lineTo(x - 6 + legSwing, floorY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, hipY);
    ctx.lineTo(x + 6 - legSwing, floorY);
    ctx.stroke();
  } else {
    const legSwing = Math.sin(stride) * LEG_LEN * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x + legSwing, floorY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x - legSwing, floorY);
    ctx.stroke();
  }

  // Torso
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 2;
  const torsoX = x - TORSO_W / 2;
  const torsoH = seated ? TORSO_H - 6 : TORSO_H;
  const r = 8;
  ctx.beginPath();
  ctx.roundRect(torsoX, torsoTop, TORSO_W, torsoH, r);
  ctx.fill();
  ctx.stroke();

  // Arms
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 2.5;
  const shoulderY = torsoTop + 6;
  if (seated) {
    // Typing: both forearms reach toward the desk, small oscillation.
    const typeBob = Math.sin(stride) * 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, shoulderY);
    ctx.lineTo(x + facing * (ARM_LEN * 0.7), shoulderY + 6 + typeBob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, shoulderY);
    ctx.lineTo(x + facing * (ARM_LEN * 0.6), shoulderY + 8 - typeBob);
    ctx.stroke();
  } else if (frontFacing) {
    // One arm raised and waving, one relaxed at the side.
    const waveAngle = Math.sin(wave) * 0.5 - 0.9;
    ctx.beginPath();
    ctx.moveTo(x + 8, shoulderY);
    ctx.lineTo(x + 8 + Math.cos(waveAngle) * ARM_LEN, shoulderY + Math.sin(waveAngle) * ARM_LEN);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 8, shoulderY);
    ctx.lineTo(x - 8, shoulderY + ARM_LEN * 0.8);
    ctx.stroke();
  } else {
    const armSwing = Math.sin(stride + Math.PI) * ARM_LEN * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, shoulderY);
    ctx.lineTo(x + armSwing, shoulderY + ARM_LEN * 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, shoulderY);
    ctx.lineTo(x - armSwing, shoulderY + ARM_LEN * 0.75);
    ctx.stroke();
  }

  // Head
  ctx.fillStyle = colors.skin;
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, headCy, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawStatusGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  status: OfficeNodeStatus,
  spinPhase: number,
  colors: OfficeColors,
) {
  const r = 9;
  const fill =
    status === 'working'
      ? colors.accent
      : status === 'needs-you'
        ? colors.warn
        : status === 'done'
          ? colors.done
          : colors.muted;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.floor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (status === 'working') {
    ctx.beginPath();
    ctx.arc(x, y, r - 3.5, spinPhase, spinPhase + Math.PI * 1.2);
    ctx.stroke();
  } else if (status === 'done') {
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 1, y + 3.5);
    ctx.lineTo(x + 4.5, y - 4);
    ctx.stroke();
  } else if (status === 'needs-you') {
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y + 4, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function MissionOfficeFloor({
  nodes,
  selectedStage,
  onSelectStage,
}: {
  nodes: readonly OfficeSceneNode[];
  selectedStage: StageName | null;
  onSelectStage: (stage: StageName) => void;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const colorsRef = React.useRef<OfficeColors | null>(null);
  const statesRef = React.useRef<Map<StageName, CharacterState>>(new Map());
  const hoverRef = React.useRef<StageName | null>(null);
  const nodesRef = React.useRef(nodes);
  const selectedRef = React.useRef(selectedStage);
  const onSelectStageRef = React.useRef(onSelectStage);
  nodesRef.current = nodes;
  selectedRef.current = selectedStage;
  onSelectStageRef.current = onSelectStage;

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    colorsRef.current = {
      accent: readToken(wrapper, '--app-accent', 'oklch(0.5 0.13 200)'),
      done: 'oklch(0.55 0.15 165)',
      warn: 'oklch(0.62 0.17 60)',
      muted: readToken(wrapper, '--app-text-muted', 'oklch(0.55 0.02 200)'),
      floor: readToken(wrapper, '--app-surface', '#f3f5f6'),
      wall: readToken(wrapper, '--app-surface-muted', '#e7ebee'),
      deskWood: readToken(wrapper, '--app-accent-soft', '#cbb994'),
      text: readToken(wrapper, '--app-text', '#1c2024'),
      textMuted: readToken(wrapper, '--app-text-muted', '#5c6570'),
      skin: '#e8b48c',
      outline: readToken(wrapper, '--app-text', '#1c2024'),
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let lastT = performance.now();
    let logicalW = 0;
    let logicalH = 0;

    // Arrow functions (const), not `function` declarations: TypeScript's
    // control-flow null-narrowing on wrapper/canvas/ctx above only
    // propagates into closures created after the narrowing checks — a
    // hoisted `function` declaration loses it and every reference below
    // would need a null check TS can't actually prove is unreachable.
    const deskX = (i: number, count: number): number => {
      const margin = 70;
      const usable = Math.max(logicalW - margin * 2, 200);
      return margin + ((i + 0.5) * usable) / count;
    };

    const ensureState = (stage: StageName, x: number) => {
      if (!statesRef.current.has(stage)) {
        statesRef.current.set(stage, {
          x,
          targetX: x,
          facing: 1,
          walkPhase: 0,
          patrolDir: 1,
        });
      }
    };

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      logicalW = Math.max(rect.width, 280);
      logicalH = 300;
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      canvas.style.width = `${logicalW}px`;
      canvas.style.height = `${logicalH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const colors = colorsRef.current;
      if (!colors) return;
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      const currentNodes = nodesRef.current;
      const floorY = logicalH - 46;
      const count = currentNodes.length || 1;

      // Background
      ctx.clearRect(0, 0, logicalW, logicalH);
      ctx.fillStyle = colors.wall;
      ctx.fillRect(0, 0, logicalW, floorY - 40);
      ctx.fillStyle = colors.floor;
      ctx.fillRect(0, floorY - 40, logicalW, logicalH - (floorY - 40));
      ctx.strokeStyle = colors.textMuted;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, floorY + 4);
      ctx.lineTo(logicalW, floorY + 4);
      ctx.stroke();
      ctx.globalAlpha = 1;

      currentNodes.forEach((_node, i) => {
        const home = deskX(i, count);
        drawDesk(ctx, home, floorY, colors);
      });

      currentNodes.forEach((node, i) => {
        const home = deskX(i, count);
        ensureState(node.stage, home);
        const s = statesRef.current.get(node.stage);
        if (!s) return;

        // Decide this tick's target based on real status.
        if (node.status === 'pending') {
          if (!reducedMotion) {
            if (Math.abs(s.x - (home + s.patrolDir * PATROL_RANGE)) < ARRIVE_EPSILON) {
              s.patrolDir = s.patrolDir === 1 ? -1 : 1;
            }
            s.targetX = home + s.patrolDir * PATROL_RANGE;
          } else {
            s.targetX = home;
          }
        } else {
          s.targetX = home + restOffsetFor(node.status);
        }

        if (!reducedMotion) {
          const dx = s.targetX - s.x;
          if (Math.abs(dx) > ARRIVE_EPSILON) {
            const dir = Math.sign(dx);
            s.facing = dir >= 0 ? 1 : -1;
            const step = dir * WALK_SPEED * dt;
            s.x += Math.abs(step) > Math.abs(dx) ? dx : step;
            s.walkPhase += dt * 9;
          } else {
            s.x = s.targetX;
            s.walkPhase += dt * (node.status === 'working' ? 4 : 1.4);
          }
        } else {
          s.x = s.targetX;
        }

        const arrived = Math.abs(s.x - s.targetX) < ARRIVE_EPSILON;
        const seated = arrived && (node.status === 'working' || node.status === 'done');
        const frontFacing = arrived && node.status === 'needs-you';
        const stride = reducedMotion ? 0 : arrived && node.status !== 'working' ? 0 : s.walkPhase;
        const bodyColor =
          node.status === 'done'
            ? colors.done
            : node.status === 'working'
              ? colors.accent
              : node.status === 'needs-you'
                ? colors.warn
                : colors.muted;

        const isSelected = node.stage === selectedRef.current;
        const isHover = node.stage === hoverRef.current;

        if (isSelected || isHover) {
          ctx.save();
          ctx.fillStyle = colors.accent;
          ctx.globalAlpha = isSelected ? 0.22 : 0.12;
          ctx.beginPath();
          ctx.ellipse(s.x, floorY + 4, 34, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        drawPerson(ctx, {
          x: s.x,
          floorY,
          facing: s.facing,
          stride,
          seated,
          frontFacing,
          wave: s.walkPhase,
          bodyColor,
          colors,
        });

        drawStatusGlyph(ctx, s.x + 14, floorY - STAND_HEIGHT - 6, node.status, s.walkPhase, colors);

        ctx.fillStyle = colors.text;
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.agentName, s.x, floorY - STAND_HEIGHT - 16);
        ctx.fillStyle = colors.textMuted;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(statusLabel(node.status), s.x, floorY + 20);
      });

      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };

    const hitTest = (clientX: number, clientY: number): StageName | null => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const floorY = logicalH - 46;
      for (const node of nodesRef.current) {
        const s = statesRef.current.get(node.stage);
        if (!s) continue;
        if (x >= s.x - 28 && x <= s.x + 28 && y >= floorY - STAND_HEIGHT - 24 && y <= floorY + 12) {
          return node.stage;
        }
      }
      return null;
    };

    const onClick = (e: MouseEvent) => {
      const stage = hitTest(e.clientX, e.clientY);
      if (stage) onSelectStageRef.current(stage);
    };
    const onMove = (e: MouseEvent) => {
      const stage = hitTest(e.clientX, e.clientY);
      hoverRef.current = stage;
      canvas.style.cursor = stage ? 'pointer' : 'default';
    };
    const onLeave = () => {
      hoverRef.current = null;
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw(performance.now());
    });
    ro.observe(wrapper);
    resize();
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(draw);
    if (reducedMotion) draw(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
    // Mount-once: every reactive value (nodes, selectedStage,
    // onSelectStage) is read through a ref inside the loop/handlers
    // above, specifically so this effect never re-runs on a status poll
    // or a parent re-render — that would tear down and restart the rAF
    // loop and reset every character's walk position each time.
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="w-full overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)]"
    >
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a plain <canvas>
          has no tabindex and isn't focusable — its pixel content just
          isn't screen-reader-accessible, which is exactly why the sr-only
          button list below exists as the real accessible equivalent. */}
      <canvas ref={canvasRef} aria-hidden="true" className="block" />
      <ul className="sr-only">
        {nodes.map((n) => (
          <li key={n.stage}>
            <button type="button" onClick={() => onSelectStage(n.stage)}>
              {n.agentName}: {statusLabel(n.status)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
