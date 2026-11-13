// Asteroids engine — TypeScript port of references/started-games/02-asteroids/game.js.
// The module has no side effects on load: all state lives inside the factory and
// keyboard listeners are attached in start() and removed in destroy().
// It knows nothing about the platform; it only reports through callbacks.

export type AsteroidsStatus = "playing" | "paused" | "gameover";

export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats: (stats: AsteroidsStats) => void; // whenever score, lives or level change
  onStatus: (status: AsteroidsStatus) => void;
  onGameOver: (finalStats: AsteroidsStats) => void;
}

export interface AsteroidsGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void; // forces game over (FIN button)
  destroy(): void; // cancels the loop and removes listeners
}

const W = 800;
const H = 600;
const MAX_DT = 0.05;

// ── Utils ───────────────────────────────────────────────────────────────────
interface Point {
  x: number;
  y: number;
}

const wrap = (v: number, max: number): number => ((v % max) + max) % max;
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

// ── Bullet ──────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    const SPEED = 520;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ────────────────────────────────────────────────────────────────
type AsteroidSize = 1 | 2 | 3;
const RADII = [0, 16, 30, 50]; // by size 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // base speed by size
const POINTS = [0, 100, 50, 20]; // points by size

class Asteroid {
  x: number;
  y: number;
  size: AsteroidSize;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: Array<[number, number]> = [];

  constructor(x: number, y: number, size: AsteroidSize = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Irregular polygon
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    const next = (this.size - 1) as AsteroidSize;
    return [new Asteroid(this.x, this.y, next), new Asteroid(this.x, this.y, next)];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-ups ───────────────────────────────────────────────────────────────
abstract class BasePowerUp {
  x: number;
  y: number;
  radius = 14;
  dead = false;
  ttl = 12;
  angle = 0;
  pulse = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    this.angle += dt * 1.8;
    this.pulse += dt * 4;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  protected begin(ctx: CanvasRenderingContext2D): void {
    const scale = 1 + Math.sin(this.pulse) * 0.12;
    const alpha = this.ttl < 2 ? this.ttl / 2 : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;
}

class PowerUp extends BasePowerUp {
  draw(ctx: CanvasRenderingContext2D): void {
    this.begin(ctx);

    // Outer ring
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Three tick marks at 0°, 120°, 240°
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (this.radius - 5), Math.sin(a) * (this.radius - 5));
      ctx.lineTo(Math.cos(a) * (this.radius + 3), Math.sin(a) * (this.radius + 3));
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = "#0ff";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class ShieldPowerUp extends BasePowerUp {
  draw(ctx: CanvasRenderingContext2D): void {
    this.begin(ctx);

    // Outer ring
    ctx.strokeStyle = "#f80";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = "#f80";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Ship ────────────────────────────────────────────────────────────────────
interface ShipInput {
  left: boolean;
  right: boolean;
  thrust: boolean;
}

class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;
  tripleShot = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
    this.tripleShot = false;
  }

  update(dt: number, input: ShipInput): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (input.left) this.angle -= ROT * dt;
    if (input.right) this.angle += ROT * dt;

    this.thrusting = input.thrust;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    const SPREAD = Math.PI / 12;

    if (this.tripleShot) {
      return [
        new Bullet(ox, oy, this.angle - SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;
    // Blink while respawn-invincible
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Classic silhouette: triangle with rear notch
    ctx.beginPath();
    ctx.moveTo(20, 0); // nose
    ctx.lineTo(-12, -9); // left wing
    ctx.lineTo(-7, 0); // rear notch
    ctx.lineTo(-12, 9); // right wing
    ctx.closePath();
    ctx.stroke();

    // Thruster flame
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
      ctx.stroke();
    }

    // Triple shot indicator
    if (this.tripleShot) {
      ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(14 + i * 6, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

// ── Particles (explosion) ───────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────
type InternalState = "playing" | "dead" | "gameover";

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("Asteroids: 2D canvas context is not available");
  const ctx: CanvasRenderingContext2D = maybeCtx;

  // ── Input ──
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  function pressed(code: string): boolean {
    const val = justPressed[code] === true;
    justPressed[code] = false;
    return val;
  }

  function clearInput(): void {
    for (const k of Object.keys(keys)) keys[k] = false;
    for (const k of Object.keys(justPressed)) justPressed[k] = false;
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (paused) return; // ignore input while paused so nothing fires on resume
    keys[e.code] = true;
    justPressed[e.code] = true;
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    keys[e.code] = false;
  };

  // Resolved at start() time, never at module load.
  let listenTarget: Window | null = null;

  // ── Game state ──
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: InternalState = "playing";
  let deadTimer = 0;

  // Triple shot power-up
  let powerup: PowerUp | null = null;
  let powerupSpawned = false;
  let tripleShotActive = false;
  let tripleShotTimer = 0;

  // Shield power-up
  let shieldPowerup: ShieldPowerUp | null = null;
  let shieldSpawned = false;
  let shieldActive = false;
  let shieldTimer = 0;
  let shieldFlash = 0;

  // ── Loop / lifecycle ──
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let now = 0; // last frame timestamp in ms (replaces performance.now() in draw)
  let started = false;
  let paused = false;
  let destroyed = false;

  // ── Platform reporting ──
  let lastStats: AsteroidsStats | null = null;
  let lastStatus: AsteroidsStatus | null = null;

  function currentStats(): AsteroidsStats {
    return { score, lives, level };
  }

  function emitStatsIfChanged(): void {
    if (
      lastStats &&
      lastStats.score === score &&
      lastStats.lives === lives &&
      lastStats.level === level
    ) {
      return;
    }
    lastStats = currentStats();
    callbacks.onStats(lastStats);
  }

  function emitStatus(next: AsteroidsStatus): void {
    if (lastStatus === next) return;
    lastStatus = next;
    callbacks.onStatus(next);
  }

  function enterGameOver(): void {
    state = "gameover";
    ship.dead = true;
    // Drop buffered presses so a stale Space does not restart instantly.
    for (const k of Object.keys(justPressed)) justPressed[k] = false;
    emitStatsIfChanged();
    emitStatus("gameover");
    callbacks.onGameOver(currentStats());
  }

  // ── Rules ──
  function spawnAsteroids(count: number): void {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame(): void {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    deadTimer = 0;
    powerup = null;
    powerupSpawned = false;
    tripleShotActive = false;
    tripleShotTimer = 0;
    shieldPowerup = null;
    shieldSpawned = false;
    shieldActive = false;
    shieldTimer = 0;
    shieldFlash = 0;
    spawnAsteroids(4);
    emitStatsIfChanged();
    emitStatus("playing");
  }

  function nextLevel(): void {
    level++;
    bullets = [];
    particles = [];
    ship.reset();
    powerup = null;
    powerupSpawned = false;
    shieldPowerup = null;
    shieldSpawned = false;
    // Restore triple shot if it was active
    if (tripleShotActive) ship.tripleShot = true;
    // Shield state (shieldActive, shieldTimer) persists through ship.reset().
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip(): void {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      enterGameOver();
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  function updateParticles(dt: number): void {
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  }

  // ── Update ──
  function update(dt: number): void {
    if (state === "gameover") {
      if (pressed("Space")) initGame();
      updateParticles(dt);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
        if (tripleShotActive) ship.tripleShot = true;
      }
      return;
    }

    // Shoot
    if (pressed("Space")) bullets.push(...ship.tryShoot());

    ship.update(dt, {
      left: keys["ArrowLeft"] === true,
      right: keys["ArrowRight"] === true,
      thrust: keys["ArrowUp"] === true,
    });
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());

          // 15% chance to spawn triple shot (only one per level)
          if (!powerupSpawned && Math.random() < 0.15) {
            powerup = new PowerUp(a.x, a.y);
            powerupSpawned = true;
          }

          // 15% chance to spawn shield (only one per level, not on level 1)
          if (!shieldSpawned && level > 1 && Math.random() < 0.15) {
            shieldPowerup = new ShieldPowerUp(a.x, a.y);
            shieldSpawned = true;
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Ship vs asteroid
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          if (shieldActive) {
            // Shield absorbs the hit: destroy asteroid, break shield, flash.
            // Keep checking other asteroids this frame so the ship can't
            // tunnel through a tight cluster for free.
            a.dead = true;
            explode(a.x, a.y, a.size * 3);
            shieldActive = false;
            shieldTimer = 0;
            shieldFlash = 0.25;
          } else {
            killShip();
            break;
          }
        }
      }
    }

    // Update power-ups
    if (powerup) {
      powerup.update(dt);
      if (powerup.dead) powerup = null;
    }
    if (shieldPowerup) {
      shieldPowerup.update(dt);
      if (shieldPowerup.dead) shieldPowerup = null;
    }

    // Ship vs triple shot collection
    if (powerup && !powerup.dead && dist(ship, powerup) < ship.radius + powerup.radius) {
      powerup.dead = true;
      tripleShotActive = true;
      ship.tripleShot = true;
      tripleShotTimer = 10;
    }

    // Ship vs shield collection
    if (
      shieldPowerup &&
      !shieldPowerup.dead &&
      dist(ship, shieldPowerup) < ship.radius + shieldPowerup.radius
    ) {
      shieldPowerup.dead = true;
      shieldActive = true;
      shieldTimer = 5;
    }

    // Triple shot countdown
    if (tripleShotActive) {
      tripleShotTimer -= dt;
      if (tripleShotTimer <= 0) {
        tripleShotActive = false;
        ship.tripleShot = false;
        tripleShotTimer = 0;
      }
    }

    // Shield countdown
    if (shieldActive) {
      shieldTimer -= dt;
      if (shieldTimer <= 0) {
        shieldActive = false;
        shieldTimer = 0;
        shieldFlash = 0.25;
      }
    }

    // Shield flash decay
    if (shieldFlash > 0) {
      shieldFlash -= dt;
      if (shieldFlash < 0) shieldFlash = 0;
    }

    // Level cleared (only while still alive in this frame)
    if (state === "playing" && asteroids.length === 0) nextLevel();
  }

  // ── Draw ──
  function drawShield(): void {
    // Active shield around the ship (pulsing orange ring)
    if (shieldActive) {
      const r = 22 + Math.sin((now / 1000) * 6) * 2;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#f80";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Shield-break flash: expand from 22 → 40 over 0.25s, alpha 0.8 → 0
    if (shieldFlash > 0) {
      const t = 1 - shieldFlash / 0.25;
      const r = 22 + (40 - 22) * t;
      ctx.save();
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.strokeStyle = "#f80";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Score, level and lives are shown by the platform HUD; only the
  // Triple Shot timer bar stays on the canvas.
  function drawTripleShotBar(): void {
    if (!tripleShotActive) return;
    const barWidth = 100;
    const barHeight = 4;
    const barX = 14;
    const barY = 14;
    const fill = tripleShotTimer / 10;

    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = "#0ff";
    ctx.fillRect(barX, barY, barWidth * fill, barHeight);

    ctx.fillStyle = "#0ff";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("TRIPLE SHOT", barX, barY + 14);
  }

  function drawOverlay(title: string, sub: string): void {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw(): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerup?.draw(ctx);
    shieldPowerup?.draw(ctx);
    bullets.forEach((b) => b.draw(ctx));
    if (state !== "gameover") drawShield();
    ship.draw(ctx);

    drawTripleShotBar();

    if (state === "gameover") {
      drawOverlay("GAME OVER", `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
    }
  }

  // ── Main loop ──
  function loop(ts: number): void {
    if (destroyed || paused) {
      rafId = null;
      return;
    }
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    now = ts;
    update(dt);
    emitStatsIfChanged();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function runLoop(): void {
    if (rafId !== null || destroyed) return;
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
      listenTarget?.addEventListener("keyup", onKeyUp);
      initGame();
      runLoop();
    },

    pause(): void {
      if (!started || destroyed || paused || state === "gameover") return;
      paused = true;
      clearInput();
      stopLoop();
      emitStatus("paused");
    },

    resume(): void {
      if (!started || destroyed || !paused) return;
      paused = false;
      clearInput();
      emitStatus("playing");
      runLoop();
    },

    end(): void {
      if (!started || destroyed || state === "gameover") return;
      if (!ship.dead) explode(ship.x, ship.y, 14);
      paused = false;
      clearInput();
      enterGameOver();
      runLoop(); // keep rendering the GAME OVER overlay and accept Space to restart
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      listenTarget?.removeEventListener("keydown", onKeyDown);
      listenTarget?.removeEventListener("keyup", onKeyUp);
      listenTarget = null;
      clearInput();
    },
  };
}
