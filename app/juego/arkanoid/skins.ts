/**
 * Arkanoid skins: presentation only (colors, glow, strokes). Game rules never
 * read these values.
 */

import type { SkinId } from "@/lib/skins";

/** Brick row identity; the engine assigns it by row and keeps it for sprites. */
export type BrickColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export interface BrickStyle {
  fill: string;
  /** Outline drawn inside the brick; `null` draws a flat block. */
  stroke: string | null;
}

export interface ArkanoidPalette {
  /**
   * Draw paddle, ball, bricks and explosions from the sprite sheet. The flat
   * colors below are then only the fallback while the image loads.
   */
  useSprites: boolean;
  background: string;
  paddle: string;
  ball: string;
  bricks: Record<BrickColor, BrickStyle>;
  /** Outline width of bricks that have a `stroke`, in canvas px. */
  brickLineWidth: number;
  explosion: string;
  /** Dimming layer behind the "level complete" message. */
  overlay: string;
  text: string;
  /** Shadow blur for paddle, ball and brick outlines; 0 disables glow. */
  glow: number;
}

export const SKINS: Record<SkinId, ArkanoidPalette> = {
  // Current look: sprite sheet, with the original engine fallback colors.
  clasico: {
    useSprites: true,
    background: "#000",
    paddle: "#00f5ff",
    ball: "#fff",
    bricks: {
      red: { fill: "#ff3b30", stroke: null },
      yellow: { fill: "#ffae00", stroke: null },
      cyan: { fill: "#00f5ff", stroke: null },
      magenta: { fill: "#ff00e5", stroke: null },
      hotpink: { fill: "#ff69b4", stroke: null },
      green: { fill: "#00ff88", stroke: null },
    },
    brickLineWidth: 0,
    explosion: "rgba(255, 255, 255, 0.6)",
    overlay: "rgba(0, 0, 0, 0.7)",
    text: "#fff",
    glow: 0,
  },
  // Site neon family: glowing tube outlines over a faint tinted fill.
  neon: {
    useSprites: false,
    background: "#04030a",
    paddle: "#00f5ff",
    ball: "#ffffff",
    bricks: {
      red: { fill: "rgba(255, 0, 110, 0.18)", stroke: "#ff006e" },
      yellow: { fill: "rgba(245, 255, 0, 0.18)", stroke: "#f5ff00" },
      cyan: { fill: "rgba(0, 245, 255, 0.18)", stroke: "#00f5ff" },
      magenta: { fill: "rgba(177, 77, 255, 0.18)", stroke: "#b14dff" },
      hotpink: { fill: "rgba(255, 122, 26, 0.18)", stroke: "#ff7a1a" },
      green: { fill: "rgba(0, 255, 136, 0.18)", stroke: "#00ff88" },
    },
    brickLineWidth: 2,
    explosion: "rgba(255, 255, 255, 0.7)",
    overlay: "rgba(4, 3, 10, 0.75)",
    text: "#e6e9ff",
    glow: 6,
  },
  // CGA palette 1, high intensity (black, cyan, magenta, white): flat solid
  // and hollow blocks, so six rows stay apart with only three ink colors.
  retro: {
    useSprites: false,
    background: "#000000",
    paddle: "#55ffff",
    ball: "#ffffff",
    bricks: {
      red: { fill: "#ff55ff", stroke: null },
      yellow: { fill: "#ffffff", stroke: null },
      cyan: { fill: "#55ffff", stroke: null },
      magenta: { fill: "#000000", stroke: "#ff55ff" },
      hotpink: { fill: "#000000", stroke: "#ffffff" },
      green: { fill: "#000000", stroke: "#55ffff" },
    },
    brickLineWidth: 4,
    explosion: "#ffffff",
    overlay: "rgba(0, 0, 0, 0.7)",
    text: "#ffffff",
    glow: 0,
  },
};
