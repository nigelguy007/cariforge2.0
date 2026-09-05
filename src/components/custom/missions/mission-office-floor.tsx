// @polsia:user-owned — the actual "Office" visualization for
// mission-office-view.tsx, round 5 (2026-09-05). Full history: user asked
// for "people in an office 3D looking" and pointed at
// github.com/pixel-agents-hq/pixel-agents, then at the VS Code extension
// thomasarisu.agent-office (a three.js voxel office) — both confirmed by
// reading their actual repos to be standalone webview/servers watching
// ONE live Claude Code terminal's hook/JSONL events, with no importable
// component, so neither was something to import. A CSS-only flat "modern
// desk" attempt was rejected ("you are not doing as i expected"), a
// genuine react-three-fiber 3D scene was rejected next ("can you make
// them liik like people who walk from desk to desk in an office room and
// not look 3d?"), and round 4 built the clarified direction: side view,
// walking characters. That still wasn't the finish line: "i dpnt like the
// characters in the office make them look like people at desks .. give
// an office scene" — round 4's figures stood next to bare desks on an
// empty floor with no real room around them, and a seated figure barely
// read as "sitting" (a 2px head-drop from standing height). Round 5 is
// still Canvas 2D side view (that part landed) but now a real *room*:
// a two-tone wall with a baseboard, windows, potted plants at both ends,
// wood-plank floor lines, an actual chair behind each desk, and a desk
// front (modesty) panel that's drawn on top of a seated figure's legs —
// the standard flat-illustration trick for "sitting at a desk" that
// round 4 didn't do, so seated figures previously looked like they were
// standing beside the desk rather than sitting at it. The same request
// also flagged the canvas rendering flush against its own card border
// with no breathing room ("the writing is too close to the border") —
// fixed by giving the wrapper real padding so the whole scene sits inset
// like a framed picture, the same visual pattern every other card in this
// app already uses, rather than the canvas bleeding edge-to-edge.
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
  readonly floorSeam: string;
  readonly wall: string;
  readonly baseboard: string;
  readonly windowFrame: string;
  readonly deskWood: string;
  readonly deskWoodDark: string;
  readonly chair: string;
  readonly plantPot: string;
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

const HEAD_R = 15;
const TORSO_W = 28;
const TORSO_H = 46;
const LEG_LEN = 34;
const ARM_LEN = 28;
const STAND_HEIGHT = HEAD_R * 2 + TORSO_H + LEG_LEN;
const WALK_SPEED = 46; // px/sec
const ARRIVE_EPSILON = 1.5;
const PATROL_RANGE = 30;
const STEP_OUT_OFFSET = 50;
const CANVAS_H = 360;
const DESK_W = 104;
const DESK_LEG_INSET = 10;

/** Where a character rests for a given status, relative to its own desk
 *  center (deskX). Patrol targets are handled separately each tick. */
function restOffsetFor(status: OfficeNodeStatus): number {
  return status === 'needs-you' ? STEP_OUT_OFFSET : 0;
}

/** The desk's top surface height above the floor — shared by the desk
 *  drawing and the seated pose math below so a seated figure's forearms
 *  actually land on the desk surface instead of floating near it. */
const DESK_TOP_DROP = 50;

/** Chair back + legs, drawn BEHIND everything else at a station (chair,
 *  then desk, then the person walks/sits in front of both) — a bare
 *  desk with no chair was part of "make them look like people at desks."
 *  Side-view silhouettes can't show real depth, so the backrest is drawn
 *  as a narrow post a few px behind the seat position (opposite the
 *  desk) with a small cap, just enough to read as "a chair," not a
 *  literal 3/4-view chair illustration. */
function drawChair(ctx: CanvasRenderingContext2D, x: number, floorY: number, colors: OfficeColors) {
  const backX = x + 10;
  const seatY = floorY - 20;
  ctx.save();
  ctx.strokeStyle = colors.chair;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  // Legs (a simple pedestal reads better at this size than four spindly legs).
  ctx.beginPath();
  ctx.moveTo(backX, seatY);
  ctx.lineTo(backX, floorY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(backX - 12, floorY);
  ctx.lineTo(backX + 12, floorY);
  ctx.stroke();
  // Seat + backrest.
  ctx.fillStyle = colors.chair;
  ctx.beginPath();
  ctx.roundRect(backX - 16, seatY - 4, 32, 8, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(backX - 14, seatY - 58, 24, 46, 8);
  ctx.fill();
  ctx.restore();
}

/** Desk top, side legs, monitor and keyboard — everything except the
 *  front face, which is drawn separately (see drawDeskFront) so it can
 *  be layered on top of a seated figure's legs instead of behind them. */
function drawDeskBack(
  ctx: CanvasRenderingContext2D,
  x: number,
  floorY: number,
  colors: OfficeColors,
) {
  const w = DESK_W;
  const topY = floorY - DESK_TOP_DROP;
  ctx.save();
  ctx.fillStyle = colors.deskWoodDark;
  ctx.fillRect(x - w / 2 + DESK_LEG_INSET - 2, topY, 4, DESK_TOP_DROP);
  ctx.fillRect(x + w / 2 - DESK_LEG_INSET - 2, topY, 4, DESK_TOP_DROP);
  ctx.fillStyle = colors.deskWood;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, topY - 7, w, 7, 2);
  ctx.fill();
  ctx.strokeStyle = colors.deskWoodDark;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Monitor, offset toward the back of the desk so it sits beside (not
  // through) the seated figure's head, plus a keyboard on the surface.
  ctx.fillStyle = colors.outline;
  ctx.fillRect(x - 16, topY - 7 - 26, 32, 20);
  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x - 13, topY - 7 - 23, 26, 14);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.outline;
  ctx.fillRect(x - 5, topY - 7 - 6, 10, 3);
  ctx.fillStyle = colors.deskWoodDark;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.roundRect(x + 18, topY - 5, 16, 6, 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** The desk's front (modesty) panel — a solid fill spanning the same
 *  footprint as the desk, from the floor up to just under the desktop.
 *  Drawing THIS after a seated figure's legs is what actually sells
 *  "sitting behind a desk": the bent legs disappear behind the panel and
 *  only the torso/arms/head (drawn after this, in turn) remain visible
 *  above the desktop — the standard trick flat office illustrations use,
 *  which round 4's desk (a thin two-leg frame with nothing to hide
 *  behind) never did. */
function drawDeskFront(
  ctx: CanvasRenderingContext2D,
  x: number,
  floorY: number,
  colors: OfficeColors,
) {
  const w = DESK_W - DESK_LEG_INSET * 2 - 6;
  const topY = floorY - DESK_TOP_DROP + 7;
  ctx.save();
  ctx.fillStyle = colors.deskWood;
  ctx.globalAlpha = 0.94;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, topY, w, floorY - topY, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Draws just the legs, in the two poses that ever show below a desk
 *  line: a walking/standing stride, or bent knees tucked toward the
 *  seat. Split out from the old single drawPerson so drawDeskFront can
 *  be layered between the legs and the upper body for a seated figure —
 *  see the header comment. */
function drawLegs(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    floorY: number;
    facing: 1 | -1;
    stride: number;
    seated: boolean;
    frontFacing: boolean;
    hipY: number;
    colors: OfficeColors;
  },
) {
  const { x, floorY, facing, stride, seated, frontFacing, hipY, colors } = opts;
  ctx.save();
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  if (seated) {
    const footX = x + facing * 16;
    ctx.beginPath();
    ctx.moveTo(x - facing * 4, hipY);
    ctx.lineTo(x + facing * 8, hipY + 16);
    ctx.lineTo(footX, floorY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - facing * 4, hipY);
    ctx.lineTo(x + facing * 3, hipY + 18);
    ctx.lineTo(footX - facing * 7, floorY);
    ctx.stroke();
  } else if (frontFacing) {
    const legSwing = Math.sin(stride) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 7, hipY);
    ctx.lineTo(x - 7 + legSwing, floorY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 7, hipY);
    ctx.lineTo(x + 7 - legSwing, floorY);
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
  ctx.restore();
}

/** Torso, arms and head — always drawn last so a seated figure reads as
 *  sitting ABOVE the desk front panel, exactly like a real desk photo. */
function drawUpperBody(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    facing: 1 | -1;
    stride: number;
    seated: boolean;
    frontFacing: boolean;
    wave: number;
    headCy: number;
    torsoTop: number;
    torsoH: number;
    bodyColor: string;
    colors: OfficeColors;
  },
) {
  const {
    x,
    facing,
    stride,
    seated,
    frontFacing,
    wave,
    headCy,
    torsoTop,
    torsoH,
    bodyColor,
    colors,
  } = opts;
  ctx.save();

  // Torso
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 2;
  const torsoX = x - TORSO_W / 2;
  ctx.beginPath();
  ctx.roundRect(torsoX, torsoTop, TORSO_W, torsoH, 9);
  ctx.fill();
  ctx.stroke();

  // Arms
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const shoulderY = torsoTop + 7;
  if (seated) {
    const typeBob = Math.sin(stride) * 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, shoulderY);
    ctx.lineTo(x + facing * (ARM_LEN * 0.7), shoulderY + 8 + typeBob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 7, shoulderY);
    ctx.lineTo(x + facing * (ARM_LEN * 0.6), shoulderY + 10 - typeBob);
    ctx.stroke();
  } else if (frontFacing) {
    const waveAngle = Math.sin(wave) * 0.5 - 0.9;
    ctx.beginPath();
    ctx.moveTo(x + 9, shoulderY);
    ctx.lineTo(x + 9 + Math.cos(waveAngle) * ARM_LEN, shoulderY + Math.sin(waveAngle) * ARM_LEN);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 9, shoulderY);
    ctx.lineTo(x - 9, shoulderY + ARM_LEN * 0.8);
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
  ctx.strokeStyle = colors.wall;
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

/** The room itself: a two-tone wall with a baseboard and windows, a
 *  wood-plank floor, and a potted plant at each end — everything that
 *  turns "a grid of desks" into "an office scene," drawn once per frame
 *  before any desk/character. Pure background; nothing here depends on
 *  agent status. */
function drawRoom(
  ctx: CanvasRenderingContext2D,
  logicalW: number,
  logicalH: number,
  floorY: number,
  colors: OfficeColors,
) {
  const baseboardY = floorY - 14;

  // Wall.
  ctx.fillStyle = colors.wall;
  ctx.fillRect(0, 0, logicalW, floorY);
  // Baseboard band, a touch darker than the wall above it.
  ctx.fillStyle = colors.baseboard;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, baseboardY, logicalW, floorY - baseboardY);
  ctx.globalAlpha = 1;

  // Windows: evenly spaced, skipped on very narrow viewports rather than
  // cramped together.
  const windowCount = logicalW > 620 ? 3 : logicalW > 420 ? 2 : 1;
  const winW = 74;
  const winH = 92;
  const winTop = 26;
  for (let i = 0; i < windowCount; i++) {
    const cx = ((i + 1) * logicalW) / (windowCount + 1);
    const left = cx - winW / 2;
    const sky = ctx.createLinearGradient(0, winTop, 0, winTop + winH);
    sky.addColorStop(0, colors.accent);
    sky.addColorStop(1, colors.wall);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = sky;
    ctx.fillRect(left, winTop, winW, winH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.windowFrame;
    ctx.lineWidth = 3;
    ctx.strokeRect(left, winTop, winW, winH);
    ctx.beginPath();
    ctx.moveTo(cx, winTop);
    ctx.lineTo(cx, winTop + winH);
    ctx.moveTo(left, winTop + winH / 2);
    ctx.lineTo(left + winW, winTop + winH / 2);
    ctx.stroke();
    ctx.restore();
  }

  // Floor: a base fill plus faint plank seams (vertical lines at an
  // angle-free, deliberately simple spacing — this is a flat illustration,
  // not a perspective floor).
  ctx.fillStyle = colors.floor;
  ctx.fillRect(0, floorY, logicalW, logicalH - floorY);
  ctx.strokeStyle = colors.floorSeam;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  const plankW = 54;
  for (let x = (logicalW % plankW) / 2; x < logicalW; x += plankW) {
    ctx.beginPath();
    ctx.moveTo(x, floorY + 4);
    ctx.lineTo(x, logicalH - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 2);
  ctx.lineTo(logicalW, floorY + 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // A plant in each far corner — office dressing that also visually
  // book-ends the row of desks.
  drawPlant(ctx, 30, floorY, colors);
  if (logicalW > 360) drawPlant(ctx, logicalW - 30, floorY, colors);
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, floorY: number, colors: OfficeColors) {
  ctx.save();
  ctx.fillStyle = colors.plantPot;
  ctx.beginPath();
  ctx.moveTo(x - 12, floorY);
  ctx.lineTo(x + 12, floorY);
  ctx.lineTo(x + 9, floorY - 20);
  ctx.lineTo(x - 9, floorY - 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.done;
  const leaves: Array<[number, number]> = [
    [0, -46],
    [-14, -34],
    [14, -34],
    [-8, -50],
    [10, -50],
  ];
  for (const [dx, dy] of leaves) {
    ctx.beginPath();
    ctx.ellipse(x + dx, floorY - 20 + dy, 11, 16, dx * 0.03, 0, Math.PI * 2);
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
      floorSeam: readToken(wrapper, '--app-border', '#d8dee2'),
      wall: readToken(wrapper, '--app-surface-muted', '#e7ebee'),
      baseboard: readToken(wrapper, '--app-border-strong', '#c4ccd1'),
      windowFrame: readToken(wrapper, '--app-text-muted', '#5c6570'),
      deskWood: readToken(wrapper, '--app-accent-soft', '#cbb994'),
      deskWoodDark: '#a68a5f',
      chair: readToken(wrapper, '--app-text-muted', '#5c6570'),
      plantPot: '#a6673f',
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
      logicalH = CANVAS_H;
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
      const floorY = logicalH - 78;
      const count = currentNodes.length || 1;

      ctx.clearRect(0, 0, logicalW, logicalH);
      drawRoom(ctx, logicalW, logicalH, floorY, colors);

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

        // Layering (see the file header + drawDeskFront comment): chair,
        // then the desk minus its front face, then this figure's legs,
        // then — only once seated — the desk's front face on top of
        // those legs, then the torso/arms/head on top of everything.
        drawChair(ctx, home, floorY, colors);
        drawDeskBack(ctx, home, floorY, colors);
        if (!seated) drawDeskFront(ctx, home, floorY, colors);

        const headCy = floorY - STAND_HEIGHT + HEAD_R + (seated ? 22 : 0);
        const torsoTop = headCy + HEAD_R;
        const torsoH = seated ? TORSO_H - 8 : TORSO_H;
        const torsoBottom = torsoTop + torsoH;
        const hipY = seated ? torsoBottom - 6 : torsoBottom;

        drawLegs(ctx, {
          x: s.x,
          floorY,
          facing: s.facing,
          stride,
          seated,
          frontFacing,
          hipY,
          colors,
        });
        if (seated) drawDeskFront(ctx, home, floorY, colors);
        drawUpperBody(ctx, {
          x: s.x,
          facing: s.facing,
          stride,
          seated,
          frontFacing,
          wave: s.walkPhase,
          headCy,
          torsoTop,
          torsoH,
          bodyColor,
          colors,
        });

        drawStatusGlyph(ctx, s.x + 16, headCy - HEAD_R - 8, node.status, s.walkPhase, colors);

        ctx.fillStyle = colors.text;
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.agentName, s.x, headCy - HEAD_R - 20);
        ctx.fillStyle = colors.textMuted;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(statusLabel(node.status), s.x, floorY + 24);
      });

      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };

    const hitTest = (clientX: number, clientY: number): StageName | null => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const floorY = logicalH - 78;
      for (const node of nodesRef.current) {
        const s = statesRef.current.get(node.stage);
        if (!s) continue;
        if (x >= s.x - 28 && x <= s.x + 28 && y >= floorY - STAND_HEIGHT - 32 && y <= floorY + 16) {
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
    // p-3/p-4: the whole point of this round's border fix — the canvas
    // used to fill this box edge-to-edge with zero inset, so its own
    // drawn content (floor, desks, status captions) sat flush against
    // the card's visible border. A real inset frame around the "room"
    // matches how every other card in this app already presents content.
    <div
      ref={wrapperRef}
      className="w-full overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 sm:p-4"
    >
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a plain <canvas>
          has no tabindex and isn't focusable — its pixel content just
          isn't screen-reader-accessible, which is exactly why the sr-only
          button list below exists as the real accessible equivalent. */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block overflow-hidden rounded-[var(--app-radius-sm)]"
      />
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
