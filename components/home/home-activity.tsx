"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GAMES } from "@/lib/data";
import {
  getRecentScores,
  getTodayRanking,
  type GlobalRankingRow,
  type ScoreEntry,
} from "@/lib/scores";
import { formatRelativeTime } from "@/lib/scores/format";

const RECENT_LIMIT = 7;
const TOP_LIMIT = 5;

interface ActivityData {
  recent: ScoreEntry[];
  top: GlobalRankingRow[];
  now: number; // one timestamp per load keeps every relative time consistent
}

const rankClass = (i: number) => (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "");

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="lb-empty">
      <p className="lb-empty-title">{title}</p>
      <p>{text}</p>
      <Link href="/juego" className="btn">
        VER JUEGOS
      </Link>
    </div>
  );
}

// Scores are fetched from Supabase from the browser, so they are loaded after
// mount; until then both cards show a loading line and server HTML stays stable.
export default function HomeActivity() {
  const [data, setData] = useState<ActivityData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRecentScores(RECENT_LIMIT), getTodayRanking(TOP_LIMIT)])
      .then(([recent, top]): ActivityData => ({ recent, top, now: Date.now() }))
      .catch((): ActivityData => ({ recent: [], top: [], now: Date.now() }))
      .then((next) => {
        if (!cancelled) setData(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="activity-grid">
      <div className="activity-card">
        <div className="ac-head">
          <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
        </div>
        {data === null ? (
          <p className="lb-empty" aria-busy="true">
            Cargando puntuaciones…
          </p>
        ) : data.recent.length === 0 ? (
          <EmptyState
            title="Aún no hay puntuaciones"
            text="Termina una partida y guarda tu nombre para abrir el feed."
          />
        ) : (
          <div className="ticker">
            {data.recent.map((r, i) => {
              const game = GAMES.find((g) => g.id === r.gameId);
              return (
                <div key={r.id} className="tick-row" style={{ animationDelay: i * 60 + "ms" }}>
                  <span className={game ? "tk-p neon-" + game.color : "tk-p"}>{r.name}</span>
                  <span className="tk-mid">▸ {game ? game.title : r.gameId}</span>
                  <span className="tk-s">+{r.score.toLocaleString("es-ES")}</span>
                  <span className="tk-t">{formatRelativeTime(r.createdAt, data.now)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="activity-card">
        <div className="ac-head">
          <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
          <Link href="/salon-de-la-fama" className="lb-link">
            VER SALÓN →
          </Link>
        </div>
        {data === null ? (
          <p className="lb-empty" aria-busy="true">
            Cargando puntuaciones…
          </p>
        ) : data.top.length === 0 ? (
          <EmptyState
            title="Hoy nadie ha puntuado todavía"
            text="Sé el primero en guardar una puntuación hoy y aparece aquí."
          />
        ) : (
          <div className="top-list">
            {data.top.map((r, i) => (
              <div key={r.name} className={"top-row" + rankClass(i)}>
                <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
                <span className="tp-bar">
                  <span className="tp-fill" style={{ width: 100 - i * 16 + "%" }}></span>
                </span>
                <span className="tp-p">{r.name}</span>
                <span className="tp-s">{r.total.toLocaleString("es-ES")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
