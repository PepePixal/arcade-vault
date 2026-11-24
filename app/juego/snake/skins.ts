/**
 * Snake skins: presentation only (colors, glow, shapes). Game rules never
 * read these values.
 */

import type { SkinId } from "@/lib/skins";

export interface SnakePalette {
  background: string;
  grid: string;
  snake: string;
  /** Corner radius of each snake segment, in canvas px. */
  snakeRadius: number;
  /**
   * How fruits are drawn: the sprite sheet (with `fruit` as fallback circle
   * while it loads), or a flat shape filled with `fruit`.
   */
  fruitStyle: "sprite" | "circle" | "diamond";
  fruit: string;
  /** Shadow blur around fruit sprites, tinted with `fruit`; 0 disables it. */
  fruitGlow: number;
  eye: string;
  pupil: string;
  /** Shadow blur for entities; 0 disables glow. */
  glow: number;
}

export const SKINS: Record<SkinId, SnakePalette> = {
  // Current look, copied from the original engine constants (grid made more
  // visible on request).
  clasico: {
    background: "#0a0a18",
    grid: "rgba(255, 255, 255, 0.14)",
    snake: "#39ff14",
    snakeRadius: 11,
    fruitStyle: "sprite",
    fruit: "#ff3b6b",
    fruitGlow: 0,
    eye: "#ffffff",
    pupil: "#0a0a18",
    glow: 10,
  },
  // Site neon family: cyan snake vs fruit sprites with a soft magenta glow
  // on near-black violet.
  neon: {
    background: "#05040d",
    grid: "rgba(0, 245, 255, 0.2)",
    snake: "#00f5ff",
    snakeRadius: 11,
    fruitStyle: "sprite",
    fruit: "#ff006e",
    fruitGlow: 8,
    eye: "#f5ff00",
    pupil: "#05040d",
    glow: 14,
  },
  // 8-bit console palette (5 colors), square blocks and a diamond fruit, no glow.
  retro: {
    background: "#1d2b53",
    grid: "#24356a",
    snake: "#ffec27",
    snakeRadius: 0,
    fruitStyle: "diamond",
    fruit: "#ff004d",
    fruitGlow: 0,
    eye: "#fff1e8",
    pupil: "#1d2b53",
    glow: 0,
  },
};
