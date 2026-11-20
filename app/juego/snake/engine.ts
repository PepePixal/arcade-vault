/**
 * Snake engine.
 *
 * Self-contained: it only knows about a canvas and three callbacks, so the
 * platform (HUD, score saving) stays outside. No module-level mutable state.
 */

import { FRUITS, FRUITS_IMAGE_SRC } from "./sprites";

export type SnakeStatus = "playing" | "paused" | "gameover";

export interface SnakeStats {
  score: number;
  lives: number; // 1 while playing, 0 on game over
  level: number; // >= 1
}

export interface SnakeCallbacks {
  onStats: (stats: SnakeStats) => void;
  onStatus: (status: SnakeStatus) => void;
  onGameOver: (finalStats: SnakeStats) => void;
}

export interface SnakeGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  destroy(): void;
}

type Cell = { x: number; y: number }; // x: 0..19, y: 0..14
type Direction = "up" | "down" | "left" | "right";
type Fruit = { cell: Cell; sprite: string }; // sprite: key of FRUITS

// ── Board ───────────────────────────────────────────────────────────────────
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CELL_SIZE = 40;
const COLS = CANVAS_WIDTH / CELL_SIZE; // 20
const ROWS = CANVAS_HEIGHT / CELL_SIZE; // 15
const INITIAL_LENGTH = 3;

// ── Rules ───────────────────────────────────────────────────────────────────
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5;
const FRUIT_KEYS = Object.keys(FRUITS);

// ── Speed (assumed values, tuned during manual verification) ────────────────
const START_STEP_MS = 150;
const STEP_DECREASE_PER_LEVEL_MS = 10;
const MIN_STEP_MS = 60;
/** Caps the time of one frame so a hidden tab never makes the snake jump. */
const MAX_FRAME_MS = 100;

const DIRECTION_VECTORS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

// ── Look ────────────────────────────────────────────────────────────────────
const COLOR_BACKGROUND = "#0a0a18";
const COLOR_GRID = "rgba(255, 255, 255, 0.04)";
const COLOR_SNAKE = "#39ff14";
const COLOR_FRUIT = "#ff3b6b"; // fallback circle when the sprite sheet is missing
const SNAKE_INSET = 2;
const SNAKE_RADIUS = 11;
const FRUIT_PADDING = 3;
const EYE_FORWARD = 6; // eye offset along the facing direction
const EYE_SIDE = 8; // eye offset across the facing direction
const EYE_RADIUS = 5;
const PUPIL_RADIUS = 2.5;
const PUPIL_SHIFT = 1.5;

function stepIntervalMs(level: number): number {
  return Math.max(MIN_STEP_MS, START_STEP_MS - (level - 1) * STEP_DECREASE_PER_LEVEL_MS);
}

function createInitialSnake(): Cell[] {
  // Head first, centered, facing right.
  const headX = Math.floor(COLS / 2);
  const y = Math.floor(ROWS / 2);
  return Array.from({ length: INITIAL_LENGTH }, (_, i) => ({ x: headX - i, y }));
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Snake: could not get a 2D canvas context");
  const g: CanvasRenderingContext2D = ctx;

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // ── Sprite sheet ──────────────────────────────────────────────────────────
  // The loop never waits for it: until it loads (or if it fails) fruits are
  // drawn as colored circles.
  const fruitImage = new Image();
  let fruitImageReady = false;
  fruitImage.onload = () => {
    if (!destroyed) fruitImageReady = true;
  };
  fruitImage.src = FRUITS_IMAGE_SRC;

  // ── State ─────────────────────────────────────────────────────────────────
  let status: SnakeStatus = "playing";
  let snake: Cell[] = createInitialSnake();
  let direction: Direction = "right"; // last direction actually moved
  let queuedDirection: Direction | null = null; // at most one per step
  let started = false; // the snake stays still until the first valid key
  let accumulator = 0; // game time pending to be consumed in steps
  let fruit: Fruit | null = null;
  let fruitsEaten = 0;
  let score = 0;
  let level = 1;

  let rafId: number | null = null;
  let lastTime = 0;
  let destroyed = false;
  let lastEmitted: SnakeStats | null = null;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  function currentStats(): SnakeStats {
    return { score, lives: status === "gameover" ? 0 : 1, level };
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

  function setStatus(next: SnakeStatus): void {
    status = next;
    callbacks.onStatus(next);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const requested = KEY_TO_DIRECTION[e.code];
    if (!requested) return;
    if (status !== "playing") return;

    // Validated against the last moved direction, not the queued one, so two
    // quick presses inside one step can never produce a 180° turn.
    if (requested === OPPOSITE[direction]) return;
    if (queuedDirection !== null) return;

    queuedDirection = requested;
    started = true;
  }

  // ── Simulation ────────────────────────────────────────────────────────────
  function gameOver(): void {
    if (status === "gameover") return;
    setStatus("gameover");
    emitStats();
    callbacks.onGameOver(currentStats());
  }

  // Picks a random cell among the free ones (never retries random positions,
  // so a nearly full board stays fast). Returns false when no cell is left.
  function spawnFruit(): boolean {
    const occupied = new Set(snake.map((c) => c.y * COLS + c.x));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(y * COLS + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      fruit = null;
      return false;
    }
    fruit = {
      cell: free[Math.floor(Math.random() * free.length)],
      sprite: FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)],
    };
    return true;
  }

  function step(): void {
    if (queuedDirection !== null) {
      direction = queuedDirection;
      queuedDirection = null;
    }

    const vector = DIRECTION_VECTORS[direction];
    const head = snake[0];
    const next: Cell = { x: head.x + vector.x, y: head.y + vector.y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      gameOver();
      return;
    }

    const eating = fruit !== null && next.x === fruit.cell.x && next.y === fruit.cell.y;

    // When not eating, the tail cell is freed by this very move, so it is safe
    // to enter it. When eating, the snake keeps its tail and grows.
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((c) => c.x === next.x && c.y === next.y)) {
      gameOver();
      return;
    }

    snake.unshift(next);
    if (!eating) {
      snake.pop();
      return;
    }

    score += POINTS_PER_FRUIT;
    fruitsEaten += 1;
    level = Math.floor(fruitsEaten / FRUITS_PER_LEVEL) + 1;
    // No free cell left: the snake fills the whole board.
    if (!spawnFruit()) gameOver();
  }

  function update(dt: number): void {
    if (status !== "playing" || !started) return;
    accumulator += dt;
    // The interval is read on every step: it shortens when the level rises.
    while (status === "playing") {
      const interval = stepIntervalMs(level);
      if (accumulator < interval) break;
      accumulator -= interval;
      step();
    }
    emitStats();
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  function draw(): void {
    g.fillStyle = COLOR_BACKGROUND;
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    g.strokeStyle = COLOR_GRID;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 1; x < COLS; x++) {
      g.moveTo(x * CELL_SIZE, 0);
      g.lineTo(x * CELL_SIZE, CANVAS_HEIGHT);
    }
    for (let y = 1; y < ROWS; y++) {
      g.moveTo(0, y * CELL_SIZE);
      g.lineTo(CANVAS_WIDTH, y * CELL_SIZE);
    }
    g.stroke();

    if (fruit) drawFruit(fruit);
    drawSnake();
  }

  function drawFruit(f: Fruit): void {
    const cx = f.cell.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = f.cell.y * CELL_SIZE + CELL_SIZE / 2;
    const sprite = FRUITS[f.sprite];

    if (fruitImageReady && sprite) {
      // Keep the sprite's aspect ratio: sizes go from 110x160 to 170x160.
      const maxSize = CELL_SIZE - FRUIT_PADDING * 2;
      const scale = Math.min(maxSize / sprite.w, maxSize / sprite.h);
      const dw = sprite.w * scale;
      const dh = sprite.h * scale;
      g.drawImage(fruitImage, sprite.x, sprite.y, sprite.w, sprite.h, cx - dw / 2, cy - dh / 2, dw, dh);
      return;
    }

    // Fallback while the PNG loads, or for good if it fails.
    g.fillStyle = COLOR_FRUIT;
    g.beginPath();
    g.arc(cx, cy, CELL_SIZE / 2 - FRUIT_PADDING - 2, 0, Math.PI * 2);
    g.fill();
  }

  function roundedRect(x: number, y: number, w: number, h: number, r: number): void {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawSnake(): void {
    g.save();
    g.shadowColor = COLOR_SNAKE;
    g.shadowBlur = 10;
    g.fillStyle = COLOR_SNAKE;
    // Tail to head, so the head is painted last and stays on top.
    for (let i = snake.length - 1; i >= 0; i--) {
      const c = snake[i];
      roundedRect(
        c.x * CELL_SIZE + SNAKE_INSET,
        c.y * CELL_SIZE + SNAKE_INSET,
        CELL_SIZE - SNAKE_INSET * 2,
        CELL_SIZE - SNAKE_INSET * 2,
        SNAKE_RADIUS,
      );
      g.fill();
    }
    g.restore();

    drawEyes(snake[0], queuedDirection ?? direction);
  }

  function drawEyes(head: Cell, facing: Direction): void {
    const cx = head.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = head.y * CELL_SIZE + CELL_SIZE / 2;
    const fwd = DIRECTION_VECTORS[facing];
    const side = { x: -fwd.y, y: fwd.x }; // perpendicular to the facing direction

    for (const sign of [-1, 1]) {
      const ex = cx + fwd.x * EYE_FORWARD + side.x * EYE_SIDE * sign;
      const ey = cy + fwd.y * EYE_FORWARD + side.y * EYE_SIDE * sign;

      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(ex, ey, EYE_RADIUS, 0, Math.PI * 2);
      g.fill();

      // The pupil looks where the snake is heading.
      g.fillStyle = "#0a0a18";
      g.beginPath();
      g.arc(ex + fwd.x * PUPIL_SHIFT, ey + fwd.y * PUPIL_SHIFT, PUPIL_RADIUS, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(now - lastTime, MAX_FRAME_MS);
    lastTime = now;
    update(dt);
    draw();
    // The loop stops by itself on game over; restart() starts it again.
    rafId = status === "gameover" ? null : requestAnimationFrame(frame);
  }

  function startLoop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function reset(): void {
    snake = createInitialSnake();
    direction = "right";
    queuedDirection = null;
    started = false;
    accumulator = 0;
    fruitsEaten = 0;
    score = 0;
    level = 1;
    status = "playing";
    spawnFruit();
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
  }

  function restart(): void {
    if (destroyed) return;
    // start() registers the listener again, so drop the old one first.
    window.removeEventListener("keydown", onKeyDown);
    start();
  }

  function destroy(): void {
    destroyed = true;
    fruitImage.onload = null;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener("keydown", onKeyDown);
  }

  return { start, pause, resume, end, restart, destroy };
}
