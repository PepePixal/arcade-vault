"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import GameOverModal from "@/components/game-over-modal";
import {
  createAsteroidsGame,
  type AsteroidsGame,
  type AsteroidsStats,
  type AsteroidsStatus,
} from "@/lib/games/asteroids/engine";
import { saveScore, setLastPlayerName } from "@/lib/scores";

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
  const [finalStats, setFinalStats] = useState<AsteroidsStats | null>(null);
  const router = useRouter();

  // Engine lifecycle: one instance per mount, destroyed on unmount
  // (also covers React Strict Mode's double mount in development).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createAsteroidsGame(canvas, {
      onStats: setStats,
      onStatus: setStatus,
      onGameOver: setFinalStats,
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

  const handleSave = async (name: string) => {
    if (!finalStats) return;
    await saveScore({ gameId, name, score: finalStats.score, level: finalStats.level });
    setLastPlayerName(name);
  };

  const handleRestart = () => {
    gameRef.current?.restart();
  };

  const handleExit = () => {
    router.push("/juego");
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

      {isGameOver && finalStats && (
        <GameOverModal
          score={finalStats.score}
          onSave={handleSave}
          onRestart={handleRestart}
          onExit={handleExit}
        />
      )}
    </>
  );
}
