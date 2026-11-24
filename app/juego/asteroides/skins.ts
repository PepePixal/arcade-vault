/**
 * Asteroids skins: presentation only (colors, glow, stroke width). Game rules
 * never read these values.
 */

import type { SkinId } from "@/lib/skins";

export interface AsteroidsPalette {
  background: string;
  ship: string;
  asteroid: string;
  bullet: string;
  /** Explosion particles as "r,g,b"; the engine adds the fading alpha. */
  particleRgb: string;
  thrust: string;
  /** Triple shot power-up, its timer bar fill. */
  tripleShot: string;
  /** Dots on the ship nose while triple shot is active. */
  tripleIndicator: string;
  /** Empty part of the triple shot timer bar. */
  barTrack: string;
  /** "TRIPLE SHOT" label under the timer bar. */
  barText: string;
  /** Shield power-up and the ring around the ship. */
  shield: string;
  /** Stroke width for ship, asteroids and power-ups, in canvas px. */
  lineWidth: number;
  /** Shadow blur for entities; 0 disables glow. */
  glow: number;
}

export const SKINS: Record<SkinId, AsteroidsPalette> = {
  // Current look, copied literally from the original engine.
  clasico: {
    background: "#000",
    ship: "#fff",
    asteroid: "#fff",
    bullet: "#fff",
    particleRgb: "255,255,255",
    thrust: "rgba(255, 130, 0, 0.85)",
    tripleShot: "#0ff",
    tripleIndicator: "rgba(0, 255, 255, 0.7)",
    barTrack: "rgba(255,255,255,0.2)",
    barText: "#0ff",
    shield: "#f80",
    lineWidth: 1.5,
    glow: 0,
  },
  // Site neon family on near-black violet: cyan ship, magenta rocks, yellow
  // shots, green triple shot and purple shield, with a subtle glow.
  neon: {
    background: "#05040d",
    ship: "#00f5ff",
    asteroid: "#ff006e",
    bullet: "#f5ff00",
    particleRgb: "255,0,110",
    thrust: "rgba(245, 255, 0, 0.85)",
    tripleShot: "#00ff88",
    tripleIndicator: "rgba(0, 255, 136, 0.7)",
    barTrack: "rgba(0, 255, 136, 0.2)",
    barText: "#00ff88",
    shield: "#b14dff",
    lineWidth: 1.5,
    glow: 6,
  },
  // Flat 8-bit palette (6 colors, Sweetie 16), chunkier strokes, no glow.
  retro: {
    background: "#1a1c2c",
    ship: "#73eff7",
    asteroid: "#94b0c2",
    bullet: "#73eff7",
    particleRgb: "148,176,194",
    thrust: "#ef7d57",
    tripleShot: "#a7f070",
    tripleIndicator: "#a7f070",
    barTrack: "#333c57",
    barText: "#a7f070",
    shield: "#ef7d57",
    lineWidth: 2,
    glow: 0,
  },
};
