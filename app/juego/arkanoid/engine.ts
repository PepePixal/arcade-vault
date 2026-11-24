// Arkanoid engine: TypeScript port of references/started-games/04-arkanoid/game.js.
// Framework-agnostic: no React, no Supabase. The canvas, the requestAnimationFrame
// loop and the keyboard/mouse listeners are created in start() and released in destroy().

import { LEVELS } from "./levels";
import { SKINS, type ArkanoidPalette, type BrickColor } from "./skins";

export type ArkanoidStatus = "playing" | "paused" | "gameover";

export interface ArkanoidStats {
  score: number;
  lives: number; // 3 at the start of each level, 0 on game over by lives
  level: number; // 1..5, always >= 1
}

export interface ArkanoidCallbacks {
  onStats: (stats: ArkanoidStats) => void;
  onStatus: (status: ArkanoidStatus) => void;
  onGameOver: (finalStats: ArkanoidStats) => void;
}

export interface ArkanoidGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void; // forces game over (FIN button)
  restart(): void; // new game: score 0, level 1, 3 lives
  destroy(): void; // cancels the loop and removes listeners
  /** Swaps the palette without touching the game state. */
  setSkin(palette: ArkanoidPalette): void;
}

export interface ArkanoidOptions {
  palette?: ArkanoidPalette;
}

const PADDLE_HEIGHT = 14;
const PADDLE_SPEED = 8; // px per step
const BALL_RADIUS = 8;
const LIVES_PER_LEVEL = 3;
const POINTS_PER_BRICK = 10;
const LEVEL_TRANSITION_MS = 1500;
const BRICK_DESCEND_INTERVAL_MS = 5000;

const BRICK_WIDTH = 74;
const BRICK_HEIGHT = 28;
const BRICK_GAP = 4;
const BRICK_OFFSET_TOP = 60;

const BRICK_COLORS: BrickColor[] = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];

const EXPLOSION_DURATION_MS = 150;
const EXPLOSION_FRAME_COUNT = 4;
const SOUND_POOL_SIZE = 4;

const SPRITESHEET_SRC = "/arkanoid/spritesheet-breakout.png";
const SOUND_BALL_BOUNCE = "/arkanoid/sounds/ball-bounce.mp3";
const SOUND_BRICK_BREAK = "/arkanoid/sounds/break-sound.mp3";

interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const PADDLE_SPRITE: SpriteRect = { sx: 32, sy: 112, sw: 162, sh: 14 };
const BALL_SPRITE: SpriteRect = { sx: 32, sy: 32, sw: 16, sh: 16 };

// Spritesheet row of each brick color (block sprite at x = 32, explosion frames from x = 256).
const BRICK_SPRITE_ROW: Record<BrickColor, number> = {
  red: 176,
  cyan: 192,
  green: 208,
  magenta: 224,
  yellow: 240,
  hotpink: 256,
};

function blockSprite(color: BrickColor): SpriteRect {
  return { sx: 32, sy: BRICK_SPRITE_ROW[color], sw: 32, sh: 16 };
}

function explosionSprite(color: BrickColor, frameIndex: number): SpriteRect {
  return { sx: 256 + frameIndex * 32, sy: BRICK_SPRITE_ROW[color], sw: 32, sh: 16 };
}

// Game speeds are expressed in px per step at 60 steps per second.
const STEP_MS = 1000 / 60;
const MAX_DT_MS = 50;

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: BrickColor;
  active: boolean;
}

interface Explosion {
  x: number;
  y: number;
  width: number;
  height: number;
  color: BrickColor;
  startTime: number; // game time
}

interface Ball {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
  options?: ArkanoidOptions,
): ArkanoidGame {
  const ctx = canvas.getContext("2d");
  let palette: ArkanoidPalette = options?.palette ?? SKINS.clasico;
  const width = canvas.width;
  const height = canvas.height;

  const paddle: Paddle = {
    x: 0,
    y: height - 40,
    width: LEVELS[0].paddleWidth,
    height: PADDLE_HEIGHT,
  };
  const ball: Ball = { x: 0, y: 0, radius: BALL_RADIUS, vx: 0, vy: 0 };

  let bricks: Brick[] = [];
  let explosions: Explosion[] = [];

  let spritesheet: HTMLImageElement | null = null;
  let spriteLoader: HTMLImageElement | null = null;
  let bounceSounds: HTMLAudioElement[] = [];
  let breakSounds: HTMLAudioElement[] = [];
  let bounceIndex = 0;
  let breakIndex = 0;

  const input = { mouseX: 0, mouseMoved: false, keyLeft: false, keyRight: false };

  let score = 0;
  let lives = LIVES_PER_LEVEL;
  let level = 1;
  let launched = false;
  let status: ArkanoidStatus = "playing";

  let started = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;
  let accumulator = 0;

  // Game time in ms: advances one STEP_MS per simulation step, so it freezes while paused.
  let gameTime = 0;
  let levelCompleteAt: number | null = null;
  let lastDescendAt: number | null = null; // game time; only used on the last level

  let lastEmitted: ArkanoidStats | null = null;

  function currentStats(): ArkanoidStats {
    return { score, lives, level };
  }

  function emitStatsIfChanged(): void {
    const prev = lastEmitted;
    if (prev && prev.score === score && prev.lives === lives && prev.level === level) return;
    lastEmitted = currentStats();
    callbacks.onStats(lastEmitted);
  }

  function setStatus(next: ArkanoidStatus): void {
    if (status === next) return;
    status = next;
    callbacks.onStatus(status);
  }

  function finishGame(): void {
    if (status === "gameover") return;
    emitStatsIfChanged();
    setStatus("gameover");
    callbacks.onGameOver(currentStats());
  }

  function createSoundPool(src: string): HTMLAudioElement[] {
    return Array.from({ length: SOUND_POOL_SIZE }, () => {
      const audio = new Audio(src);
      audio.preload = "auto";
      return audio;
    });
  }

  // Reuses a small pool of Audio objects; a rejected play() (autoplay policy) is ignored.
  function playBounce(): void {
    if (bounceSounds.length === 0) return;
    const audio = bounceSounds[bounceIndex];
    bounceIndex = (bounceIndex + 1) % bounceSounds.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function playBreak(): void {
    if (breakSounds.length === 0) return;
    const audio = breakSounds[breakIndex];
    breakIndex = (breakIndex + 1) % breakSounds.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function createBricks(levelIndex: number): Brick[] {
    const pattern = LEVELS[levelIndex - 1].pattern;
    const cols = pattern[0].length;
    const offsetLeft = (width - (cols * BRICK_WIDTH + (cols - 1) * BRICK_GAP)) / 2;

    const created: Brick[] = [];
    for (let row = 0; row < pattern.length; row++) {
      for (let col = 0; col < cols; col++) {
        if (pattern[row][col] !== "1") continue;
        created.push({
          x: offsetLeft + col * (BRICK_WIDTH + BRICK_GAP),
          y: BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          color: BRICK_COLORS[row % BRICK_COLORS.length],
          active: true,
        });
      }
    }
    return created;
  }

  function startLevel(levelIndex: number): void {
    const config = LEVELS[levelIndex - 1];

    level = levelIndex;
    lives = LIVES_PER_LEVEL;
    levelCompleteAt = null;
    lastDescendAt = levelIndex === LEVELS.length ? gameTime : null;
    explosions = [];
    bricks = createBricks(levelIndex);

    paddle.width = config.paddleWidth;
    paddle.x = (width - config.paddleWidth) / 2;

    ball.x = width / 2;
    ball.y = height - 60;
    ball.vx = config.ballSpeed;
    ball.vy = -config.ballSpeed;

    launched = false;
  }

  function resetBallAndPaddle(): void {
    paddle.x = (width - paddle.width) / 2;
    ball.x = width / 2;
    ball.y = height - 60;
    // Kept from the original game: the ball comes back at speed 4,
    // ignoring the level's ballSpeed.
    ball.vx = 4;
    ball.vy = -4;
    launched = false;
  }

  function updatePaddle(): void {
    if (input.mouseMoved) {
      paddle.x = input.mouseX - paddle.width / 2;
      input.mouseMoved = false;
    }
    if (input.keyLeft) paddle.x -= PADDLE_SPEED;
    if (input.keyRight) paddle.x += PADDLE_SPEED;

    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x > width - paddle.width) paddle.x = width - paddle.width;

    if (!launched) {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - ball.radius;
    }
  }

  function checkPaddleCollision(): void {
    if (ball.vy <= 0) return;

    const closestX = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.width));
    const closestY = Math.max(paddle.y, Math.min(ball.y, paddle.y + paddle.height));
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;

    if (dx * dx + dy * dy > ball.radius * ball.radius) return;

    ball.y = paddle.y - ball.radius;

    const speed = Math.hypot(ball.vx, ball.vy);
    const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    ball.vx = hitPos * speed;
    ball.vy = -Math.abs(ball.vy);

    playBounce();
  }

  function checkBrickCollisions(): void {
    for (const brick of bricks) {
      if (!brick.active) continue;

      const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
      const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;

      if (dx * dx + dy * dy > ball.radius * ball.radius) continue;

      brick.active = false;
      score += POINTS_PER_BRICK;

      explosions.push({
        x: brick.x,
        y: brick.y,
        width: brick.width,
        height: brick.height,
        color: brick.color,
        startTime: gameTime,
      });
      playBreak();

      const overlapX = ball.radius - Math.abs(dx);
      const overlapY = ball.radius - Math.abs(dy);
      if (overlapX < overlapY) ball.vx = -ball.vx;
      else ball.vy = -ball.vy;

      break;
    }
  }

  function checkWinCondition(): void {
    if (bricks.some((brick) => brick.active)) return;

    if (level < LEVELS.length) {
      if (levelCompleteAt === null) levelCompleteAt = gameTime;
    } else {
      // Clearing the last level ends the game as a victory.
      finishGame();
    }
  }

  // Last level: every 5 s of game time the bricks drop one row; touching the paddle ends the game.
  function descendBricksIfNeeded(): void {
    if (level !== LEVELS.length || lastDescendAt === null) return;
    if (gameTime - lastDescendAt < BRICK_DESCEND_INTERVAL_MS) return;

    const rowStep = BRICK_HEIGHT + BRICK_GAP;
    let reachedPaddle = false;
    for (const brick of bricks) {
      if (!brick.active) continue;
      brick.y += rowStep;
      if (brick.y + brick.height >= paddle.y) reachedPaddle = true;
    }

    lastDescendAt = gameTime;
    if (reachedPaddle) finishGame();
  }

  function updateBall(): void {
    ball.x += ball.vx;
    ball.y += ball.vy;

    checkPaddleCollision();
    checkBrickCollisions();

    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = -ball.vx;
      playBounce();
    }
    if (ball.x + ball.radius > width) {
      ball.x = width - ball.radius;
      ball.vx = -ball.vx;
      playBounce();
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = -ball.vy;
      playBounce();
    }

    if (ball.y - ball.radius > height) {
      lives -= 1;
      if (lives <= 0) {
        lives = 0;
        finishGame();
      } else {
        resetBallAndPaddle();
      }
    }
  }

  // One fixed 60 Hz simulation step.
  function step(): void {
    gameTime += STEP_MS;

    if (levelCompleteAt !== null) {
      if (gameTime - levelCompleteAt >= LEVEL_TRANSITION_MS) startLevel(level + 1);
      return;
    }

    updatePaddle();
    if (launched) updateBall();
    explosions = explosions.filter((e) => gameTime - e.startTime < EXPLOSION_DURATION_MS);
    if (status === "playing") descendBricksIfNeeded();
    if (status === "playing") checkWinCondition();
  }

  // Sprite sheet in use: only when the skin asks for it and the image has loaded.
  function activeSheet(): HTMLImageElement | null {
    return palette.useSprites ? spritesheet : null;
  }

  function drawFromSheet(img: HTMLImageElement, sprite: SpriteRect, x: number, y: number, w: number, h: number): void {
    ctx?.drawImage(img, sprite.sx, sprite.sy, sprite.sw, sprite.sh, x, y, w, h);
  }

  // Glow for entities only; always reset afterwards so background and text stay crisp.
  function withGlow(color: string, draw: (g: CanvasRenderingContext2D) => void): void {
    if (!ctx) return;
    if (palette.glow > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = palette.glow;
    }
    draw(ctx);
    ctx.shadowBlur = 0;
  }

  function drawPaddle(): void {
    const sheet = activeSheet();
    if (sheet) {
      drawFromSheet(sheet, PADDLE_SPRITE, paddle.x, paddle.y, paddle.width, paddle.height);
      return;
    }
    withGlow(palette.paddle, (g) => {
      g.fillStyle = palette.paddle;
      g.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    });
  }

  function drawBall(): void {
    const x = ball.x - ball.radius;
    const y = ball.y - ball.radius;
    const size = ball.radius * 2;
    const sheet = activeSheet();
    if (sheet) {
      drawFromSheet(sheet, BALL_SPRITE, x, y, size, size);
      return;
    }
    withGlow(palette.ball, (g) => {
      g.fillStyle = palette.ball;
      g.beginPath();
      g.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      g.fill();
    });
  }

  function drawBrick(brick: Brick): void {
    const sheet = activeSheet();
    if (sheet) {
      drawFromSheet(sheet, blockSprite(brick.color), brick.x, brick.y, brick.width, brick.height);
      return;
    }
    if (!ctx) return;
    const style = palette.bricks[brick.color];
    ctx.fillStyle = style.fill;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    const stroke = style.stroke;
    if (stroke && palette.brickLineWidth > 0) {
      const lw = palette.brickLineWidth;
      withGlow(stroke, (g) => {
        g.strokeStyle = stroke;
        g.lineWidth = lw;
        g.strokeRect(brick.x + lw / 2, brick.y + lw / 2, brick.width - lw, brick.height - lw);
      });
    }
  }

  function drawExplosion(explosion: Explosion, frameIndex: number): void {
    const sheet = activeSheet();
    if (sheet) {
      drawFromSheet(
        sheet,
        explosionSprite(explosion.color, frameIndex),
        explosion.x,
        explosion.y,
        explosion.width,
        explosion.height,
      );
      return;
    }
    if (!ctx) return;
    ctx.fillStyle = palette.explosion;
    ctx.fillRect(explosion.x, explosion.y, explosion.width, explosion.height);
  }

  function render(): void {
    if (!ctx) return;

    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);

    drawPaddle();
    drawBall();

    for (const brick of bricks) {
      if (!brick.active) continue;
      drawBrick(brick);
    }

    for (const explosion of explosions) {
      const elapsed = gameTime - explosion.startTime;
      const frameIndex = Math.min(
        EXPLOSION_FRAME_COUNT - 1,
        Math.floor(elapsed / (EXPLOSION_DURATION_MS / EXPLOSION_FRAME_COUNT)),
      );
      drawExplosion(explosion, frameIndex);
    }

    if (levelCompleteAt !== null) {
      ctx.fillStyle = palette.overlay;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = palette.text;
      ctx.font = "40px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Nivel ${level} completado`, width / 2, height / 2);
      ctx.textAlign = "left";
    }
  }

  function frame(ts: number): void {
    if (destroyed) return;

    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT_MS);
    lastTime = ts;

    if (status === "playing") {
      accumulator += dt;
      while (accumulator >= STEP_MS && status === "playing") {
        step();
        accumulator -= STEP_MS;
      }
      emitStatsIfChanged();
    }

    render();
    rafId = requestAnimationFrame(frame);
  }

  function launch(): void {
    if (status === "playing" && !launched) launched = true;
  }

  function onMouseMove(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    // The canvas is scaled by CSS: convert to internal 800x600 coordinates.
    input.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseMoved = true;
  }

  function onClick(): void {
    launch();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") input.keyLeft = true;
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") input.keyRight = true;

    if ((e.key === " " || e.key === "Enter") && status === "playing" && !launched) {
      e.preventDefault();
      launch();
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") input.keyLeft = false;
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") input.keyRight = false;
  }

  function resetGame(): void {
    score = 0;
    gameTime = 0;
    input.mouseMoved = false;
    startLevel(1);
    lastTime = null;
    accumulator = 0;
  }

  return {
    start(): void {
      if (started || destroyed) return;
      started = true;

      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("click", onClick);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      // The loop starts right away; sprites are used once the image loads.
      const loader = new Image();
      loader.onload = () => {
        if (destroyed) return; // loaded after destroy(): ignore
        spritesheet = loader;
      };
      loader.onerror = () => {
        spritesheet = null; // keep drawing the plain-shape fallback
      };
      loader.src = SPRITESHEET_SRC;
      spriteLoader = loader;

      bounceSounds = createSoundPool(SOUND_BALL_BOUNCE);
      breakSounds = createSoundPool(SOUND_BRICK_BREAK);

      resetGame();
      callbacks.onStatus(status);
      emitStatsIfChanged();
      rafId = requestAnimationFrame(frame);
    },

    pause(): void {
      if (status !== "playing") return;
      setStatus("paused");
    },

    resume(): void {
      if (status !== "paused") return;
      lastTime = null; // avoid a big dt jump after pause/resume
      accumulator = 0;
      setStatus("playing");
    },

    end(): void {
      finishGame();
    },

    restart(): void {
      if (destroyed) return;
      resetGame();
      lastEmitted = null;
      emitStatsIfChanged();
      setStatus("playing");
    },

    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(rafId);
      if (spriteLoader) {
        spriteLoader.onload = null;
        spriteLoader.onerror = null;
        spriteLoader = null;
      }
      spritesheet = null;
      for (const audio of [...bounceSounds, ...breakSounds]) audio.pause();
      bounceSounds = [];
      breakSounds = [];
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },

    setSkin(next: ArkanoidPalette): void {
      palette = next;
      // The loop repaints every frame (also while paused or over); repaint now too
      // so the change shows immediately.
      if (started && !destroyed) render();
    },
  };
}
