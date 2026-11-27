/**
 * Frogger skins: presentation only (colors and glow). Game rules never read
 * these values.
 */

import type { SkinId } from "@/lib/skins";

export interface FroggerPalette {
  road: string;
  roadLine: string;
  river: string;
  safe: string;
  goalsBg: string;
  goalMouth: string;
  goalBorder: string;
  /** Car body colors, picked by lane row. */
  cars: readonly string[];
  wheel: string;
  truck: string;
  truckCab: string;
  log: string;
  logLine: string;
  turtle: string;
  turtleScale: string;
  turtleSubmerged: string;
  frog: string;
  frogDark: string;
  eyeWhite: string;
  eyePupil: string;
  /** Time bar fill by remaining ratio (> 50 %, > 25 %, rest). Never green. */
  timeHigh: string;
  timeMid: string;
  timeLow: string;
  /** Track behind the time bar, also covering the gap above the goal mouths. */
  timeTrack: string;
  /** Shadow blur for entities; 0 disables glow. */
  glow: number;
}

export const SKINS: Record<SkinId, FroggerPalette> = {
  // Current look, copied verbatim from the original engine COLORS table.
  clasico: {
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
    timeHigh: "#1f5fe0",
    timeMid: "#f2c230",
    timeLow: "#e5322d",
    timeTrack: "#0a0a14",
    glow: 0,
  },
  // Night arcade: near-black lanes, site neon family, moderate glow.
  neon: {
    road: "#040408",
    roadLine: "#2a1240",
    river: "#03081c",
    safe: "#061a10",
    goalsBg: "#2a0620",
    goalMouth: "#040408",
    goalBorder: "#ff006e",
    cars: ["#ff006e", "#00f5ff", "#ff7ad9"],
    wheel: "#000000",
    truck: "#9d7bff",
    truckCab: "#e0d6ff",
    log: "#b85000",
    logLine: "#ff8a00",
    turtle: "#f5ff00",
    turtleScale: "#5c6000",
    turtleSubmerged: "rgba(245, 255, 0, 0.35)",
    frog: "#00ff88",
    frogDark: "#00a85a",
    eyeWhite: "#ffffff",
    eyePupil: "#000000",
    timeHigh: "#00f5ff",
    timeMid: "#f5ff00",
    timeLow: "#ff006e",
    timeTrack: "#040408",
    glow: 8,
  },
  // Amber phosphor CRT: six flat tones, no glow.
  retro: {
    road: "#120a00",
    roadLine: "#5c3a00",
    river: "#2e1c00",
    safe: "#4a2e00",
    goalsBg: "#b06d00",
    goalMouth: "#120a00",
    goalBorder: "#ffe6a8",
    cars: ["#ffb000", "#b06d00", "#ffb000"],
    wheel: "#120a00",
    truck: "#b06d00",
    truckCab: "#ffe6a8",
    log: "#b06d00",
    logLine: "#2e1c00",
    turtle: "#ffb000",
    turtleScale: "#5c3a00",
    turtleSubmerged: "rgba(255, 176, 0, 0.35)",
    frog: "#ffe6a8",
    frogDark: "#ffb000",
    eyeWhite: "#ffb000",
    eyePupil: "#120a00",
    timeHigh: "#ffe6a8",
    timeMid: "#ffb000",
    timeLow: "#b06d00",
    timeTrack: "#120a00",
    glow: 0,
  },
};
