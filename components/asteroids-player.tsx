"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  createAsteroidsGame,
  type AsteroidsGame,
  type AsteroidsStats,
  type AsteroidsStatus,
} from "@/lib/games/asteroids/engine";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const INITIAL_STATS: AsteroidsStats = { score: 0, lives: 3, level: 1 };

// Keys the game uses that would otherwise scroll the page.
const SCROLL_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

interface AsteroidsPlayerProps {
  gameId: string;
  title: string;
}

export default function AsteroidsPlayer({ gameId, title }: AsteroidsPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  const [stats, setStats] = useState<AsteroidsStats>(INITIAL_STATS);
  const [status, setStatus] = useState<AsteroidsStatus>("playing");

  // Engine lifecycle: one instance per mount, destroyed on unmount
  // (also covers React Strict Mode's double mount in development).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createAsteroidsGame(canvas, {
      onStats: setStats,
      onStatus: setStatus,
      onGameOver: () => {
        // Session-only scores: nothing is persisted yet.
        // Future hook point for saving a score (see SPEC 05, Decisions).
      },
    });
    gameRef.current = game;
    game.start();

    return () => {
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, []);

  // Prevent page scroll with Space and arrows while the game is mounted.
  // keyup is also cancelled so Space does not "click" a focused HUD button.
  useEffect(() => {
    const preventScroll = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    };
    window.addEventListener("keydown", preventScroll);
    window.addEventListener("keyup", preventScroll);
    return () => {
      window.removeEventListener("keydown", preventScroll);
      window.removeEventListener("keyup", preventScroll);
    };
  }, []);

  const isGameOver = status === "gameover";
  const isPaused = status === "paused";

  const togglePause = (e: MouseEvent<HTMLButtonElement>) => {
    // Release focus so Space (the fire key) never targets the HUD button.
    e.currentTarget.blur();
    const game = gameRef.current;
    if (!game) return;
    if (isPaused) game.resume();
    else game.pause();
  };

  const endGame = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    gameRef.current?.end();
  };

  return (
    <>
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              INVITADO
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{stats.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v" aria-label={`${stats.lives} vidas`}>
              {stats.lives > 0 ? Array.from({ length: stats.lives }, () => "♥").join(" ") : "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(stats.level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="btn yellow"
            onClick={togglePause}
            disabled={isGameOver}
            aria-pressed={isPaused}
          >
            {isPaused ? "REANUDAR" : "PAUSA"}
          </button>
          <button type="button" className="btn magenta" onClick={endGame} disabled={isGameOver}>
            FIN
          </button>
          <Link href={`/juego/${gameId}`} className="btn purple">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            className="asteroids-canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-label={`${title}: ←/→ rotar, ↑ propulsar, Espacio disparar`}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
    </>
  );
}
