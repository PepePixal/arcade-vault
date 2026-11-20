"use client";

import { useState } from "react";
import type { Game } from "@/lib/data";
import { GameCard } from "@/components/games/game-card";

export default function Library({ games }: { games: Game[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("TODOS");

  // "TODOS" plus the categories that have at least one game.
  const categories = ["TODOS", ...new Set(games.map((g) => g.cat))];

  const query = q.trim().toLowerCase();
  const filtered = games.filter(
    (g) => (cat === "TODOS" || g.cat === cat) && g.title.toLowerCase().includes(query),
  );

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un juego por nombre…" />
        </div>
        <div className="av-chips">
          {categories.map((c) => (
            <button key={c} className={"chip" + (cat === c ? " active" : "")} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="lb-empty">
          <p className="lb-empty-title">NINGÚN JUEGO ENCONTRADO</p>
        </div>
      ) : (
        <div className="av-grid">
          {filtered.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
