// Tetris engine — TypeScript port of references/started-games/03-tetris/game.js.
// The module has no side effects on load: all state lives inside the factory and
// keyboard listeners are attached in start() and removed in destroy().
// It knows nothing about the platform; it only reports through callbacks.

import { SKINS, type TetrisPalette } from "./skins";

export type TetrisStatus = "playing" | "paused" | "gameover";

export interface TetrisStats {
  score: number;
  lives: number; // 1 while playing, 0 on game over
  level: number; // always >= 1
}

export interface TetrisCallbacks {
  onStats: (stats: TetrisStats) => void; // whenever score, lives or level change
  onStatus: (status: TetrisStatus) => void;
  onGameOver: (finalStats: TetrisStats) => void;
}

export interface TetrisGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void; // forces game over (FIN button)
  restart(): void; // new game: 1 life, level 1, score 0
  destroy(): void; // cancels the loop and removes listeners
  /** Swaps the palette without touching the game state. */
  setSkin(palette: TetrisPalette): void;
}

export interface TetrisOptions {
  palette?: TetrisPalette;
}

// Canvas is 4:3 and scaled by CSS; the 10x20 board sits centered with the next piece beside it.
const W = 800;
const H = 600;
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const BOARD_W = COLS * BLOCK;
const BOARD_H = ROWS * BLOCK;
const BOARD_X = (W - BOARD_W) / 2;
const BOARD_Y = (H - BOARD_H) / 2;

const NEXT_X = BOARD_X + BOARD_W + 40;
const NEXT_Y = BOARD_Y + 40;
const NEXT_BOX = 4 * BLOCK;

const MAX_DT_MS = 50;
const LINES_PER_LEVEL = 10;
const LINE_SCORES = [0, 100, 300, 500, 800];

// Cell value 0 is "empty"; 1..7 are the seven standard pieces (I, O, T, S, Z, J, L).
// Their colors live in the active skin palette (palette.pieces[value - 1]).
const PIECES: readonly (readonly (readonly number[])[])[] = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
];

const PIECE_TYPES = PIECES.length - 1;
const KICKS = [0, -1, 1, -2, 2];

type Shape = number[][];

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

const createBoard = (): number[][] =>
  Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));

const dropIntervalFor = (level: number): number => Math.max(100, 1000 - (level - 1) * 90);

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  options?: TetrisOptions,
): TetrisGame {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Tetris: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;

  // Active skin; only read by the drawing code.
  let palette: TetrisPalette = options?.palette ?? SKINS.clasico;

  // ── Game state ──
  let board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0; // internal only: drives the level, not shown in the HUD
  let level = 1;
  let over = false;
  let dropInterval = dropIntervalFor(1);
  let dropAccum = 0;

  // ── Loop / lifecycle ──
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let started = false;
  let paused = false;
  let destroyed = false;

  // ── Platform reporting ──
  let lastStats: TetrisStats | null = null;
  let lastStatus: TetrisStatus | null = null;

  function currentStats(): TetrisStats {
    return { score, lives: over ? 0 : 1, level };
  }

  function emitStatsIfChanged(): void {
    const stats = currentStats();
    if (
      lastStats &&
      lastStats.score === stats.score &&
      lastStats.lives === stats.lives &&
      lastStats.level === stats.level
    ) {
      return;
    }
    lastStats = stats;
    callbacks.onStats(stats);
  }

  function emitStatus(nextStatus: TetrisStatus): void {
    if (lastStatus === nextStatus) return;
    lastStatus = nextStatus;
    callbacks.onStatus(nextStatus);
  }

  function enterGameOver(): void {
    over = true;
    stopLoop();
    emitStatsIfChanged();
    draw();
    emitStatus("gameover");
    callbacks.onGameOver(currentStats());
  }

  // ── Rules ──
  function collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate(): void {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge(): void {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
      }
    }
  }

  function clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared === 0) return;
    lines += cleared;
    score += (LINE_SCORES[cleared] ?? 0) * level;
    level = Math.floor(lines / LINES_PER_LEVEL) + 1;
    dropInterval = dropIntervalFor(level);
  }

  function spawn(): void {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) enterGameOver();
  }

  function lockPiece(): void {
    merge();
    clearLines();
    spawn();
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop(): void {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop(): void {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function initGame(): void {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    over = false;
    dropInterval = dropIntervalFor(level);
    dropAccum = 0;
    current = randomPiece();
    next = randomPiece();
    emitStatsIfChanged();
    emitStatus("playing");
    draw();
  }

  // ── Input ──
  const onKeyDown = (e: KeyboardEvent): void => {
    if (paused || over) return; // ignore input while paused or finished
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        if (!e.repeat) tryRotate();
        break;
      case "Space":
        if (!e.repeat) hardDrop();
        break;
      default:
        return;
    }
    emitStatsIfChanged();
    if (!over) draw();
  };

  // Resolved at start() time, never at module load.
  let listenTarget: Window | null = null;

  // ── Drawing ──
  function drawBlock(
    target: CanvasRenderingContext2D,
    px: number,
    py: number,
    colorIndex: number,
    alpha = 1,
    backdrop: string = palette.board, // color behind the block, for hollow patterns
  ): void {
    if (colorIndex < 1 || colorIndex > PIECE_TYPES) return;
    const color = palette.pieces[colorIndex - 1];
    const pattern = palette.patterns[colorIndex - 1];
    const s = BLOCK - 2;
    const x = px + 1;
    const y = py + 1;

    target.save();
    target.globalAlpha = alpha;
    // Glow only on solid entities, never on the ghost preview.
    if (palette.glow > 0 && alpha === 1) {
      target.shadowColor = color;
      target.shadowBlur = palette.glow;
    }

    if (pattern === "tube") {
      target.globalAlpha = alpha * 0.25;
      target.fillStyle = color;
      target.fillRect(x, y, s, s);
      target.globalAlpha = alpha;
      target.strokeStyle = color;
      target.lineWidth = 2;
      target.strokeRect(x + 2, y + 2, s - 4, s - 4);
    } else {
      target.fillStyle = color;
      target.fillRect(x, y, s, s);
      if (pattern === "frame") {
        // Hollow ring with a colored core, like 8-bit console blocks.
        target.shadowBlur = 0;
        target.fillStyle = backdrop;
        target.fillRect(x + 5, y + 5, s - 10, s - 10);
        target.fillStyle = color;
        target.fillRect(x + 10, y + 10, s - 20, s - 20);
      }
    }

    if (palette.highlight) {
      target.shadowBlur = 0;
      target.fillStyle = palette.highlight;
      target.fillRect(x, y, s, 4);
    }
    target.restore();
    target.shadowBlur = 0;
    target.globalAlpha = 1;
  }

  function drawGrid(): void {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(BOARD_X + c * BLOCK, BOARD_Y);
      ctx.lineTo(BOARD_X + c * BLOCK, BOARD_Y + BOARD_H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(BOARD_X, BOARD_Y + r * BLOCK);
      ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * BLOCK);
    }
    ctx.stroke();
  }

  function drawPiece(piece: Piece, gy: number, alpha: number): void {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        drawBlock(
          ctx,
          BOARD_X + (piece.x + c) * BLOCK,
          BOARD_Y + (gy + r) * BLOCK,
          piece.shape[r][c],
          alpha,
        );
      }
    }
  }

  function drawNext(): void {
    ctx.fillStyle = palette.label;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("SIGUIENTE", NEXT_X, NEXT_Y - 12);
    ctx.strokeStyle = palette.frame;
    ctx.lineWidth = 1;
    ctx.strokeRect(NEXT_X, NEXT_Y, NEXT_BOX, NEXT_BOX);

    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawBlock(
          ctx,
          NEXT_X + (offX + c) * BLOCK,
          NEXT_Y + (offY + r) * BLOCK,
          shape[r][c],
          1,
          palette.background,
        );
      }
    }
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = palette.board;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    drawGrid();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawBlock(ctx, BOARD_X + c * BLOCK, BOARD_Y + r * BLOCK, board[r][c]);
      }
    }

    if (!over) drawPiece(current, ghostY(), palette.ghostAlpha);
    drawPiece(current, current.y, 1);

    ctx.strokeStyle = palette.frame;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 1, BOARD_Y - 1, BOARD_W + 2, BOARD_H + 2);

    drawNext();
  }

  // ── Main loop ──
  function loop(ts: number): void {
    if (destroyed || paused || over) {
      rafId = null;
      return;
    }
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT_MS);
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece();
    }
    emitStatsIfChanged();
    if (over) return; // enterGameOver() already stopped the loop and drew the last frame
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function runLoop(): void {
    if (rafId !== null || destroyed || over) return;
    lastTime = null; // avoid a big dt jump after pause/resume
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop(): void {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ── Public API ──
  return {
    start(): void {
      if (started || destroyed) return;
      started = true;
      listenTarget = canvas.ownerDocument.defaultView;
      listenTarget?.addEventListener("keydown", onKeyDown);
      initGame();
      runLoop();
    },

    pause(): void {
      if (!started || destroyed || paused || over) return;
      paused = true;
      stopLoop();
      emitStatus("paused");
    },

    resume(): void {
      if (!started || destroyed || !paused) return;
      paused = false;
      emitStatus("playing");
      runLoop();
    },

    end(): void {
      if (!started || destroyed || over) return;
      paused = false;
      enterGameOver();
    },

    restart(): void {
      if (!started || destroyed) return;
      paused = false;
      stopLoop();
      initGame();
      runLoop();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      listenTarget?.removeEventListener("keydown", onKeyDown);
      listenTarget = null;
    },

    setSkin(next: TetrisPalette): void {
      palette = next;
      // While playing the loop repaints on its own; when paused or over it is stopped.
      if (started && !destroyed && (paused || over)) draw();
    },
  };
}
