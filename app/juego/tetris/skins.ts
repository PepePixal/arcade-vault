/**
 * Tetris skins: presentation only (colors, glow, block style). Game rules
 * never read these values.
 */

import type { SkinId } from "@/lib/skins";

/**
 * How a block is painted:
 * - `solid`: filled square.
 * - `frame`: 8-bit "hollow" block (colored ring with a colored core).
 * - `tube`: neon tube (translucent fill with a bright outline).
 */
export type BlockPattern = "solid" | "frame" | "tube";

/** Seven entries in piece order: I, O, T, S, Z, J, L. */
type PerPiece<T> = readonly [T, T, T, T, T, T, T];

export interface TetrisPalette {
  /** Whole canvas, around the board. */
  background: string;
  /** Board well behind the blocks. */
  board: string;
  grid: string;
  /** Board outline and next-piece box. */
  frame: string;
  /** "SIGUIENTE" label. */
  label: string;
  pieces: PerPiece<string>;
  patterns: PerPiece<BlockPattern>;
  /** Top bevel strip on each block; null for flat blocks. */
  highlight: string | null;
  /** Opacity of the landing preview (ghost piece). */
  ghostAlpha: number;
  /** Shadow blur for blocks; 0 disables glow. */
  glow: number;
}

export const SKINS: Record<SkinId, TetrisPalette> = {
  // Current look, copied literally from the original engine constants.
  clasico: {
    background: "#05050f",
    board: "#0a0a18",
    grid: "#22222e",
    frame: "#3a3a52",
    label: "#8a8aa3",
    pieces: ["#4dd0e1", "#ffd54f", "#ba68c8", "#81c784", "#e57373", "#8b0000", "#ffb74d"],
    patterns: ["solid", "solid", "solid", "solid", "solid", "solid", "solid"],
    highlight: "rgba(255,255,255,0.12)",
    ghostAlpha: 0.2,
    glow: 0,
  },
  // Site neon family as glowing tubes on near-black; subtle grid, no glow on it.
  neon: {
    background: "#03030a",
    board: "#06051a",
    grid: "rgba(0, 245, 255, 0.08)",
    frame: "rgba(0, 245, 255, 0.45)",
    label: "#00f5ff",
    pieces: ["#00f5ff", "#f5ff00", "#b14dff", "#00ff88", "#ff006e", "#4d7cff", "#ff8a00"],
    patterns: ["tube", "tube", "tube", "tube", "tube", "tube", "tube"],
    highlight: null,
    ghostAlpha: 0.35,
    glow: 8,
  },
  // 8-bit console palette (PICO-8 subset): five block colors, solid vs hollow
  // blocks tell apart pieces that share a color, flat and without glow.
  retro: {
    background: "#000000",
    board: "#1d2b53",
    grid: "#24356a",
    frame: "#fff1e8",
    label: "#fff1e8",
    pieces: ["#29adff", "#ffec27", "#fff1e8", "#00e436", "#ff004d", "#29adff", "#ffec27"],
    patterns: ["solid", "solid", "solid", "solid", "solid", "frame", "frame"],
    highlight: null,
    ghostAlpha: 0.3,
    glow: 0,
  },
};
