"use client";

import { useEffect, useState } from "react";
import { getGameScores, type ScoreEntry } from "@/lib/scores";
import { formatScoreDate } from "@/lib/scores/format";

const ROW_LIMIT = 10;

// Scores live in the browser (localStorage for now), so they are loaded after mount.
export default function GameLeaderboard({ gameId }: { gameId: string }) {
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGameScores(gameId, ROW_LIMIT)
      .then((rows) => {
        if (!cancelled) setScores(rows);
      })
      .catch(() => {
        if (!cancelled) setScores([]);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {scores === null ? (
        <p className="lb-empty" aria-busy="true">
          Cargando puntuaciones…
        </p>
      ) : scores.length === 0 ? (
        <div className="lb-empty">
          <p className="lb-empty-title">Aún no hay puntuaciones</p>
          <p>Termina una partida y guarda tu nombre para estrenar esta tabla.</p>
        </div>
      ) : (
        scores.map((r, i) => (
          <div key={r.id} className={"lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}>
            <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
            <div className="pl">
              {r.name}
              <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
                {formatScoreDate(r.createdAt)}
              </div>
            </div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
          </div>
        ))
      )}
    </div>
  );
}
