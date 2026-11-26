// Frogger engine: built from scratch with canvas primitives (no bitmap sprites).
// Framework-agnostic: no React, no Supabase. The canvas, the requestAnimationFrame
// loop and the keyboard listener (on window) are created in start() and released in destroy().

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export type FroggerStatus = "playing" | "paused" | "gameover";

export interface FroggerStats {
  score: number;
  lives: number; // 3 at the start, 0 on game over
  level: number; // round number, always >= 1
}

export interface FroggerCallbacks {
  onStats: (stats: FroggerStats) => void;
  onStatus: (status: FroggerStatus) => void;
  onGameOver: (finalStats: FroggerStats) => void;
}

export interface FroggerGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void; // forces game over (FIN button)
  restart(): void; // new game: score 0, level 1, 3 lives
  destroy(): void; // cancels the loop and removes listeners
}

// ---------------------------------------------------------------------------
// Grid and zones
// ---------------------------------------------------------------------------

const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640, scaled to the container with CSS
const CANVAS_H = ROWS * CELL; // 560

// Zones (row index, 0 = top)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type Direction = "up" | "down" | "left" | "right";

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  diveT?: number; // turtles only: ms elapsed in the current dive cycle (independent per group)
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

// ---------------------------------------------------------------------------
// Lane map
// ---------------------------------------------------------------------------

interface LaneSpec {
  row: number;
  type: Entity["type"];
  width: number; // cells per entity (vehicles 1-3, logs 2-4, turtle groups 2-3)
  count: number; // entities per lane, evenly spaced over the loop
  speed: number; // px/frame at level 1
  dir: 1 | -1;
}

const LEVEL_SPEED_FACTOR = 1.15; // +15 % on every speed per level
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
const TURTLE_LANE_PHASE_MS = 700; // offsets the dive cycle between lanes

// River lanes (rows 1-6): speeds 1-3 px/frame, gaps of at least 1 cell.
const RIVER_LANES: LaneSpec[] = [
  { row: ROW_RIVER_TOP, type: "log", width: 3, count: 3, speed: 1.6, dir: 1 },
  { row: 2, type: "log", width: 2, count: 4, speed: 2.5, dir: -1 },
  { row: 3, type: "turtle", width: 2, count: 4, speed: 1.5, dir: 1 },
  { row: 4, type: "log", width: 4, count: 3, speed: 2.0, dir: -1 },
  { row: 5, type: "log", width: 3, count: 3, speed: 1.0, dir: 1 },
  { row: ROW_RIVER_BOT, type: "turtle", width: 3, count: 4, speed: 1.2, dir: -1 },
];

// Road lanes (rows 8-12): speeds 1.5-4 px/frame, alternating directions, crossable gaps.
const ROAD_LANES: LaneSpec[] = [
  { row: ROW_ROAD_TOP, type: "truck", width: 3, count: 2, speed: 1.8, dir: -1 },
  { row: 9, type: "car", width: 1, count: 2, speed: 4.0, dir: 1 },
  { row: 10, type: "truck", width: 2, count: 3, speed: 2.2, dir: -1 },
  { row: 11, type: "car", width: 1, count: 3, speed: 2.8, dir: 1 },
  { row: ROW_ROAD_BOT, type: "car", width: 1, count: 3, speed: 1.5, dir: -1 },
];

function buildLanes(level: number): Lane[] {
  const factor = LEVEL_SPEED_FACTOR ** (Math.max(1, level) - 1);

  return [...RIVER_LANES, ...ROAD_LANES].map((spec, laneIndex) => {
    // An entity wraps after travelling COLS + width cells, so spreading `count`
    // entities over that length keeps the gaps constant while they loop.
    const spacing = (COLS + spec.width) / spec.count;

    const entities = Array.from({ length: spec.count }, (_, i): Entity => {
      const entity: Entity = { col: i * spacing - spec.width, width: spec.width, type: spec.type };
      if (spec.type === "turtle") {
        const diveT =
          ((i * TURTLE_CYCLE_MS) / spec.count + laneIndex * TURTLE_LANE_PHASE_MS) % TURTLE_CYCLE_MS;
        entity.diveT = diveT;
        entity.submerged = diveT >= TURTLE_VISIBLE_MS;
      }
      return entity;
    });

    return { row: spec.row, speed: spec.speed * factor, dir: spec.dir, entities };
  });
}

// ---------------------------------------------------------------------------
// Goals, timing and colors
// ---------------------------------------------------------------------------

const GOAL_COUNT = 5;
const GOAL_WIDTH = 2; // cells per goal mouth
const GOAL_COLS = [1, 4, 7, 10, 13]; // first column of each mouth (walls in between)

const JUMP_MS = 120;
const LIVES_START = 3;
const START_COL = Math.floor(COLS / 2);
const POINTS_PER_ROW = 10;
const POINTS_PER_GOAL = 50;
const POINTS_PER_ROUND = 200;
const TIME_BONUS_PER_SECOND = 10; // bonus = whole seconds left x 10, on each goal
const MAX_FRAME_MS = 50; // clamps dt after tab switches

const ROUND_TIME_START_S = 15;
const ROUND_TIME_MIN_S = 8;
const TIME_BAR_H = 6; // px, drawn at the top of the goals row

/** Round timer: 15 s at level 1, one second less per level, never below 8 s. */
function roundTimeMs(level: number): number {
  return Math.max(ROUND_TIME_MIN_S, ROUND_TIME_START_S - (level - 1)) * 1000;
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const DIRECTION_DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

// Single color table so every drawing reads from one place.
const COLORS = {
  road: "#0b0b0f",
  roadLine: "#3a3a44",
  river: "#0b2a5a",
  safe: "#1d4d22",
  goalsBg: "#5fbf4a",
  goalMouth: "#174d1c",
  goalBorder: "#e8c33a",
  cars: ["#e5322d", "#f2c230", "#2f7de1"],
  wheel: "#111111",
  truck: "#8a8f98",
  truckCab: "#c9ccd2",
  log: "#7a4a21",
  logLine: "#4f2e12",
  turtle: "#2f9e44",
  turtleScale: "#1c6b2c",
  turtleSubmerged: "rgba(47, 158, 68, 0.35)",
  frog: "#7cff4f",
  frogDark: "#2f8f1f",
  eyeWhite: "#ffffff",
  eyePupil: "#000000",
  timeHigh: "#3ddc4a",
  timeMid: "#f2c230",
  timeLow: "#e5322d",
  timeTrack: "#0d2a10",
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function createFroggerGame(canvas: HTMLCanvasElement, callbacks: FroggerCallbacks): FroggerGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Frogger: could not get a 2D canvas context");
  const g: CanvasRenderingContext2D = ctx;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // ── State ─────────────────────────────────────────────────────────────────
  let status: FroggerStatus = "playing";
  let score = 0;
  let lives = LIVES_START;
  let level = 1;
  let lanes: Lane[] = buildLanes(level);
  let goals: boolean[] = new Array<boolean>(GOAL_COUNT).fill(false);
  let frog: Frog = createFrog();
  let facing: Direction = "up";
  let pendingDir: Direction | null = null;
  let bestRow = ROW_START; // highest row (lowest index) reached this round
  let timeLeft = roundTimeMs(level);

  let rafId: number | null = null;
  let lastTime = 0;
  let destroyed = false;
  let lastEmitted: FroggerStats | null = null;

  function createFrog(): Frog {
    return { col: START_COL, row: ROW_START, animating: false, animT: 0, targetCol: START_COL, targetRow: ROW_START };
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────
  function currentStats(): FroggerStats {
    return { score, lives, level };
  }

  // Only notify the HUD when something actually changed.
  function emitStats(): void {
    const next = currentStats();
    const prev = lastEmitted;
    if (prev && prev.score === next.score && prev.lives === next.lives && prev.level === next.level) {
      return;
    }
    lastEmitted = next;
    callbacks.onStats(next);
  }

  function setStatus(next: FroggerStatus): void {
    status = next;
    callbacks.onStatus(next);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  // Only arrow keys; P / Esc are deliberately ignored (pause belongs to the platform).
  function onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEY_TO_DIRECTION[e.code] ?? KEY_TO_DIRECTION[e.key];
    if (!dir) return;
    e.preventDefault(); // keeps the page from scrolling
    if (status !== "playing") return;
    pendingDir = dir;
  }

  // ── Simulation ────────────────────────────────────────────────────────────
  function gameOver(): void {
    if (status === "gameover") return;
    lives = 0;
    setStatus("gameover");
    emitStats();
    callbacks.onGameOver(currentStats());
  }

  // Every new frog (after a goal or a death) starts with a full timer and its
  // own forward-progress scoring.
  function resetFrog(): void {
    frog = createFrog();
    facing = "up";
    pendingDir = null;
    bestRow = ROW_START;
    timeLeft = roundTimeMs(level);
  }

  /** True when a road vehicle covers the frog's center on its row. */
  function checkRoadCollision(f: Frog, allLanes: Lane[]): boolean {
    if (f.row < ROW_ROAD_TOP || f.row > ROW_ROAD_BOT) return false;
    const center = f.col + 0.5;
    for (const lane of allLanes) {
      if (lane.row !== f.row) continue;
      for (const entity of lane.entities) {
        if (center >= entity.col && center < entity.col + entity.width) return true;
      }
    }
    return false;
  }

  /**
   * Resolves a landing on the goals row: marks a free mouth and scores it.
   * Returns false when the frog hit a wall or an occupied mouth (death).
   */
  function checkGoal(f: Frog, goalState: boolean[]): boolean {
    if (f.row !== ROW_GOALS) return false;
    const index = GOAL_COLS.findIndex((col) => f.col >= col && f.col < col + GOAL_WIDTH);
    if (index === -1 || goalState[index]) return false;
    goalState[index] = true;
    score += POINTS_PER_GOAL + Math.floor(Math.max(0, timeLeft) / 1000) * TIME_BONUS_PER_SECOND;
    return true;
  }

  /** River entity under the frog, or null (submerged turtles give no support). */
  function getSupport(f: Frog, allLanes: Lane[]): Entity | null {
    const lane = allLanes.find((l) => l.row === f.row);
    if (!lane || f.row < ROW_RIVER_TOP || f.row > ROW_RIVER_BOT) return null;
    const center = f.col + 0.5;
    for (const entity of lane.entities) {
      if (center >= entity.col && center < entity.col + entity.width) {
        return entity.type === "turtle" && entity.submerged ? null : entity;
      }
    }
    return null;
  }

  function isRiverRow(row: number): boolean {
    return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
  }

  // One life less. The HUD hears about every loss; at zero lives the game ends
  // (gameOver() emits lives = 0 before onGameOver and the loop stops by itself).
  function killFrog(): void {
    if (status !== "playing") return; // never kill twice in the frame that ended the game
    lives -= 1;
    if (lives <= 0) {
      gameOver();
      return;
    }
    emitStats();
    resetFrog();
  }

  // All five mouths filled: next round with faster lanes and a shorter timer.
  // The level change reaches the HUD through emitStats() at the end of update().
  function completeRound(): void {
    score += POINTS_PER_ROUND;
    goals = new Array<boolean>(GOAL_COUNT).fill(false);
    level += 1;
    lanes = buildLanes(level);
    resetFrog(); // back to ROW_START, center column, timer for the new level
  }

  // Resolves the cell the frog just landed on: goal, water, vehicle or progress.
  function resolveLanding(): void {
    if (frog.row === ROW_GOALS) {
      if (!checkGoal(frog, goals)) killFrog();
      else if (goals.every(Boolean)) completeRound();
      else resetFrog();
      return;
    }
    if (isRiverRow(frog.row) && !getSupport(frog, lanes)) {
      killFrog();
      return;
    }
    if (checkRoadCollision(frog, lanes)) {
      killFrog();
      return;
    }
    if (frog.row < bestRow) {
      score += (bestRow - frog.row) * POINTS_PER_ROW;
      bestRow = frog.row;
    }
  }

  // Deaths that can happen while the frog stands still: a vehicle drives into it,
  // its turtles dive, or the log carries it out through a side edge.
  function checkStandingDeaths(): void {
    if (frog.animating) return;
    if (checkRoadCollision(frog, lanes)) {
      killFrog();
      return;
    }
    if (isRiverRow(frog.row) && (frog.col < 0 || frog.col > COLS - 1 || !getSupport(frog, lanes))) {
      killFrog();
    }
  }

  function startJump(dir: Direction): void {
    const { dc, dr } = DIRECTION_DELTA[dir];
    const targetCol = frog.col + dc;
    const targetRow = frog.row + dr;
    facing = dir;
    // The frog can never leave the grid through the sides or the bottom.
    if (targetCol < 0 || targetCol > COLS - 1 || targetRow < ROW_GOALS || targetRow > ROW_START) return;
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
  }

  function moveLanes(dt: number): void {
    for (const lane of lanes) {
      // speed is px/frame at 60 fps (~16 ms); col is measured in cells.
      const delta = (lane.speed * lane.dir * (dt / 16)) / CELL;
      for (const entity of lane.entities) {
        entity.col += delta;
        const loop = COLS + entity.width;
        if (lane.dir === 1 && entity.col >= COLS) entity.col -= loop;
        if (lane.dir === -1 && entity.col <= -entity.width) entity.col += loop;

        if (entity.type === "turtle") {
          entity.diveT = ((entity.diveT ?? 0) + dt) % TURTLE_CYCLE_MS;
          entity.submerged = entity.diveT >= TURTLE_VISIBLE_MS;
        }
      }
    }
  }

  function update(dt: number): void {
    if (status !== "playing") return;

    // River carry is computed from the support before the lanes move.
    const support = !frog.animating && isRiverRow(frog.row) ? getSupport(frog, lanes) : null;
    const carryLane = support ? lanes.find((l) => l.row === frog.row) : undefined;

    moveLanes(dt);

    if (!frog.animating && pendingDir) {
      startJump(pendingDir);
      pendingDir = null;
    }

    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) {
        frog.col = isRiverRow(frog.targetRow) ? frog.targetCol : Math.round(frog.targetCol);
        frog.row = frog.targetRow;
        frog.animating = false;
        frog.animT = 0;
        resolveLanding();
      }
    } else if (carryLane) {
      frog.col += (carryLane.speed * carryLane.dir * (dt / 16)) / CELL;
    }

    checkStandingDeaths();

    timeLeft -= dt;
    if (timeLeft <= 0) killFrog();

    emitStats();
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  function draw(): void {
    drawBackground();
    drawGoals();
    for (const lane of lanes) {
      for (const entity of lane.entities) drawEntity(entity, lane.row, lane.dir);
    }
    drawFrog();
    drawTimeBar();
  }

  function drawBackground(): void {
    for (let row = 0; row < ROWS; row++) {
      let color = COLORS.road;
      if (row === ROW_GOALS) color = COLORS.goalsBg;
      else if (isRiverRow(row)) color = COLORS.river;
      else if (row === ROW_SAFE_MID || row === ROW_START) color = COLORS.safe;
      g.fillStyle = color;
      g.fillRect(0, row * CELL, CANVAS_W, CELL);
    }
    // Dashed lane separators on the road.
    g.strokeStyle = COLORS.roadLine;
    g.lineWidth = 2;
    g.setLineDash([12, 12]);
    for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
      g.beginPath();
      g.moveTo(0, row * CELL);
      g.lineTo(CANVAS_W, row * CELL);
      g.stroke();
    }
    g.setLineDash([]);
  }

  function drawGoals(): void {
    const top = ROW_GOALS * CELL + TIME_BAR_H + 2;
    const h = CELL - TIME_BAR_H - 4;
    GOAL_COLS.forEach((col, i) => {
      const x = col * CELL + 3;
      const w = GOAL_WIDTH * CELL - 6;
      g.fillStyle = COLORS.goalMouth;
      g.fillRect(x, top, w, h);
      g.strokeStyle = COLORS.goalBorder;
      g.lineWidth = 2;
      g.strokeRect(x, top, w, h);
      if (goals[i]) drawFrogShape(x + w / 2, top + h / 2, "up", false, 0.8);
    });
  }

  function drawEntity(entity: Entity, row: number, dir: 1 | -1): void {
    const x = entity.col * CELL;
    const y = row * CELL;
    const w = entity.width * CELL;
    switch (entity.type) {
      case "car":
        drawCar(x, y, w, dir, row);
        break;
      case "truck":
        drawTruck(x, y, w, dir);
        break;
      case "log":
        drawLog(x, y, w);
        break;
      case "turtle":
        drawTurtles(x, y, entity.width, entity.submerged === true);
        break;
    }
  }

  function drawCar(x: number, y: number, w: number, dir: 1 | -1, row: number): void {
    const bodyColor = COLORS.cars[row % COLORS.cars.length];
    g.fillStyle = COLORS.wheel;
    for (const wx of [x + 8, x + w - 8]) {
      for (const wy of [y + 9, y + CELL - 9]) {
        g.beginPath();
        g.arc(wx, wy, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = bodyColor;
    g.fillRect(x + 3, y + 10, w - 6, CELL - 20);
    // Windshield on the front side.
    g.fillStyle = COLORS.road;
    const wsX = dir === 1 ? x + w - 14 : x + 8;
    g.fillRect(wsX, y + 13, 6, CELL - 26);
  }

  function drawTruck(x: number, y: number, w: number, dir: 1 | -1): void {
    const cabW = 22;
    const cabX = dir === 1 ? x + w - cabW - 2 : x + 2;
    const trailerX = dir === 1 ? x + 2 : x + cabW + 4;
    g.fillStyle = COLORS.truck;
    g.fillRect(trailerX, y + 7, w - cabW - 6, CELL - 14);
    g.fillStyle = COLORS.truckCab;
    g.fillRect(cabX, y + 10, cabW, CELL - 20);
    g.fillStyle = COLORS.wheel;
    g.fillRect(cabX + (dir === 1 ? 14 : 3), y + 13, 5, CELL - 26);
  }

  function drawLog(x: number, y: number, w: number): void {
    g.fillStyle = COLORS.log;
    g.fillRect(x + 2, y + 6, w - 4, CELL - 12);
    g.strokeStyle = COLORS.logLine;
    g.lineWidth = 2;
    for (let lx = x + 14; lx < x + w - 10; lx += 22) {
      g.beginPath();
      g.moveTo(lx, y + 12);
      g.lineTo(lx + 10, y + 12);
      g.moveTo(lx + 6, y + CELL - 13);
      g.lineTo(lx + 16, y + CELL - 13);
      g.stroke();
    }
  }

  function drawTurtles(x: number, y: number, count: number, submerged: boolean): void {
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (submerged) {
        g.strokeStyle = COLORS.turtleSubmerged;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, 14, 0, Math.PI * 2);
        g.stroke();
        continue;
      }
      g.fillStyle = COLORS.turtle;
      g.beginPath();
      g.arc(cx, cy, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = COLORS.turtleScale;
      for (const [dx, dy] of [[0, 0], [-6, -6], [6, -6], [-6, 6], [6, 6]]) {
        g.beginPath();
        g.arc(cx + dx, cy + dy, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function drawFrog(): void {
    let col = frog.col;
    let row = frog.row;
    if (frog.animating) {
      const t = Math.min(frog.animT / JUMP_MS, 1);
      col += (frog.targetCol - frog.col) * t;
      row += (frog.targetRow - frog.row) * t;
    }
    drawFrogShape(col * CELL + CELL / 2, row * CELL + CELL / 2, facing, frog.animating, 1);
  }

  function drawFrogShape(cx: number, cy: number, dir: Direction, jumping: boolean, scale: number): void {
    const angle = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir];
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    g.scale(scale, scale);

    // Legs: extended while jumping, tucked otherwise.
    const reach = jumping ? 15 : 9;
    g.strokeStyle = COLORS.frogDark;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-8, -6);
    g.lineTo(-reach, -reach);
    g.moveTo(8, -6);
    g.lineTo(reach, -reach);
    g.moveTo(-8, 6);
    g.lineTo(-reach, reach);
    g.moveTo(8, 6);
    g.lineTo(reach, reach);
    g.stroke();

    // Body: 28 x 24 ellipse.
    g.fillStyle = COLORS.frog;
    g.beginPath();
    g.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    g.fill();

    // Eyes.
    for (const ex of [-6, 6]) {
      g.fillStyle = COLORS.eyeWhite;
      g.beginPath();
      g.arc(ex, -9, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = COLORS.eyePupil;
      g.beginPath();
      g.arc(ex, -10, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawTimeBar(): void {
    const ratio = Math.max(0, timeLeft / roundTimeMs(level));
    g.fillStyle = COLORS.timeTrack;
    g.fillRect(0, ROW_GOALS * CELL, CANVAS_W, TIME_BAR_H);
    g.fillStyle = ratio > 0.5 ? COLORS.timeHigh : ratio > 0.25 ? COLORS.timeMid : COLORS.timeLow;
    g.fillRect(0, ROW_GOALS * CELL, CANVAS_W * ratio, TIME_BAR_H);
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(now - lastTime, MAX_FRAME_MS);
    lastTime = now;
    update(dt);
    draw(); // keeps drawing while paused
    // The loop stops by itself on game over; restart() starts it again.
    rafId = status === "gameover" ? null : requestAnimationFrame(frame);
  }

  function startLoop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function reset(): void {
    score = 0;
    lives = LIVES_START;
    level = 1;
    lanes = buildLanes(level);
    goals = new Array<boolean>(GOAL_COUNT).fill(false);
    bestRow = ROW_START;
    status = "playing";
    resetFrog();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function start(): void {
    if (destroyed) return;
    reset();
    window.addEventListener("keydown", onKeyDown);
    callbacks.onStatus(status);
    lastEmitted = null;
    emitStats();
    startLoop();
  }

  function pause(): void {
    if (destroyed || status !== "playing") return;
    setStatus("paused");
  }

  function resume(): void {
    if (destroyed || status !== "paused") return;
    // Restart the clock so the time spent paused is never consumed.
    lastTime = performance.now();
    setStatus("playing");
  }

  function end(): void {
    if (destroyed) return;
    gameOver();
    draw();
  }

  function restart(): void {
    if (destroyed) return;
    // start() registers the listener again, so drop the old one first.
    window.removeEventListener("keydown", onKeyDown);
    start();
  }

  function destroy(): void {
    destroyed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener("keydown", onKeyDown);
  }

  return { start, pause, resume, end, restart, destroy };
}
