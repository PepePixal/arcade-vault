"use client";

import { useGameStats } from "@/components/use-game-stats";

const NO_DATA = "—";

// Renders the "Partidas" and "Mejor global" blocks of the detail stat strip.
// It is a fragment so the strip's grid keeps owning the layout.
export default function GameStats({ gameId }: { gameId: string }) {
  const stats = useGameStats(gameId);
  const hasPlays = stats !== null && stats.plays > 0;

  return (
    <>
      <div>
        <div className="l">Partidas</div>
        <div className="v">{hasPlays ? stats.plays.toLocaleString("es-ES") : NO_DATA}</div>
      </div>
      <div>
        <div className="l">Mejor global</div>
        <div className="v" style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}>
          {hasPlays && stats.best !== null ? stats.best.toLocaleString("es-ES") : NO_DATA}
        </div>
      </div>
    </>
  );
}
