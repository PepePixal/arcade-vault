"use client";

interface MobileStatsBarProps {
  score: number;
  lives: number;
  level: number;
}

/** One-line score / lives / level bar shown above the canvas on mobile, where the desktop HUD is hidden. */
export default function MobileStatsBar({ score, lives, level }: MobileStatsBarProps) {
  return (
    <div className="md:hidden">
      <div className="gp-stats">
        <div className="gp-stat">
          <span className="l">Puntos</span>
          <span className="v">{score.toLocaleString("es-ES")}</span>
        </div>
        <div className="gp-stat lives">
          <span className="l">Vidas</span>
          <span className="v" aria-label={`${lives} vidas`}>
            {lives > 0 ? Array.from({ length: lives }, () => "♥").join(" ") : "—"}
          </span>
        </div>
        <div className="gp-stat level">
          <span className="l">Nivel</span>
          <span className="v">{String(level).padStart(2, "0")}</span>
        </div>
      </div>
    </div>
  );
}
