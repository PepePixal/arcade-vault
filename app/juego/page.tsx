"use client";

import { useState } from "react";
import { GAMES, CATS } from "@/lib/data";
import { GameCard } from "@/components/game-card";

export default function Biblioteca() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("TODOS");

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
          {CATS.map((c) => (
            <button key={c} className={"chip" + (cat === c ? " active" : "")} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {GAMES.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
    </div>
  );
}
