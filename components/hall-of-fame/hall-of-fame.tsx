"use client";

import { useEffect, useState } from "react";
import { getGameScores, getGlobalRanking } from "@/lib/scores";
import { formatScoreDate } from "@/lib/scores/format";

const GLOBAL_TAB = "global";
const ROW_LIMIT = 12;

interface TabOption {
  id: string;
  title: string;
}

// Shared shape for both the per-game list and the global ranking.
interface HallRow {
  key: string;
  rank: number;
  name: string;
  score: number;
  meta: string; // date for a game, "N juegos" for the global ranking
}

async function loadRows(tab: string): Promise<HallRow[]> {
  if (tab === GLOBAL_TAB) {
    const rows = await getGlobalRanking(ROW_LIMIT);
    return rows.map((r) => ({
      key: r.name,
      rank: r.rank,
      name: r.name,
      score: r.total,
      meta: r.games === 1 ? "1 juego" : `${r.games} juegos`,
    }));
  }
  const rows = await getGameScores(tab, ROW_LIMIT);
  return rows.map((r, i) => ({
    key: r.id,
    rank: i + 1,
    name: r.name,
    score: r.score,
    meta: formatScoreDate(r.createdAt),
  }));
}

const rankClass = (i: number) => (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "");

function PodiumSlot({ row, place }: { row: HallRow | undefined; place: 1 | 2 | 3 }) {
  const tone = place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
  return (
    <div className={"podium-slot " + tone}>
      {place === 1 && (
        <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>
          CAMPEÓN
        </div>
      )}
      <div className="rank-num" style={place === 1 ? { fontSize: 36, marginTop: 4 } : undefined}>
        {String(place).padStart(2, "0")}
      </div>
      <div className="name">{row?.name ?? "—"}</div>
      <div className="score" style={place === 1 ? { fontSize: 20 } : undefined}>
        {row ? row.score.toLocaleString("es-ES") : "—"}
      </div>
      <div className="date">{row?.meta ?? "Puesto libre"}</div>
    </div>
  );
}

export default function HallOfFame({ games }: { games: TabOption[] }) {
  const [tab, setTab] = useState<string>(GLOBAL_TAB);
  const [result, setResult] = useState<{ tab: string; rows: HallRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRows(tab)
      .catch(() => [])
      .then((rows) => {
        if (!cancelled) setResult({ tab, rows });
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const tabs: TabOption[] = [{ id: GLOBAL_TAB, title: "GLOBAL" }, ...games];
  const rows = result?.tab === tab ? result.rows : null;
  const isGlobal = tab === GLOBAL_TAB;

  return (
    <>
      <div className="hall-tabs" role="tablist" aria-label="Ranking">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            className={"chip" + (t.id === tab ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {rows === null ? (
          <div className="hall-table">
            <p className="lb-empty" aria-busy="true">
              Cargando puntuaciones…
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="hall-table">
            <div className="lb-empty">
              <p className="lb-empty-title">Aún no hay puntuaciones</p>
              <p>
                {isGlobal
                  ? "Termina una partida en cualquier juego y guarda tu nombre para abrir el ranking."
                  : "Termina una partida y guarda tu nombre para estrenar esta tabla."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="podium">
              <PodiumSlot row={rows[1]} place={2} />
              <PodiumSlot row={rows[0]} place={1} />
              <PodiumSlot row={rows[2]} place={3} />
            </div>

            <div className="hall-table">
              <div className="th">
                <div>RANGO</div>
                <div>JUGADOR</div>
                <div>{isGlobal ? "TOTAL" : "PUNTUACIÓN"}</div>
                <div>{isGlobal ? "JUEGOS" : "FECHA"}</div>
              </div>
              {rows.map((r, i) => (
                <div key={r.key} className={"tr" + rankClass(i)} style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                  <div className="pl">{r.name}</div>
                  <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                  <div className="dt">{r.meta}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
