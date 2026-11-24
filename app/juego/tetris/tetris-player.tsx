"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import GameOverModal from "@/components/games/game-over-modal";
import SkinPicker from "@/components/games/skin-picker";
import {
  createTetrisGame,
  type TetrisGame,
  type TetrisStats,
  type TetrisStatus,
} from "./engine";
import { SKINS } from "./skins";
import { saveScore, setLastPlayerName } from "@/lib/scores";
import { getLastSkin, setLastSkin, type SkinId } from "@/lib/skins";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const INITIAL_STATS: TetrisStats = { score: 0, lives: 1, level: 1 };

// Keys the game uses that would otherwise scroll the page.
const SCROLL_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// The stored skin never changes behind our back, so there is nothing to subscribe to.
const noSubscribe = () => () => {};

interface TetrisPlayerProps {
  gameId: string;
  title: string;
}

export default function TetrisPlayer({ gameId, title }: TetrisPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisGame | null>(null);
  const [stats, setStats] = useState<TetrisStats>(INITIAL_STATS);
  const [status, setStatus] = useState<TetrisStatus>("playing");
  const [finalStats, setFinalStats] = useState<TetrisStats | null>(null);
  const router = useRouter();

  // Stored skin: "clasico" on the server and during hydration, the saved one
  // right after (no hydration mismatch). A click overrides it locally.
  const storedSkin = useSyncExternalStore<SkinId>(
    noSubscribe,
    () => getLastSkin(gameId),
    () => "clasico",
  );
  const [chosenSkin, setChosenSkin] = useState<SkinId | null>(null);
  const skin = chosenSkin ?? storedSkin;

  // Engine lifecycle: one instance per mount, destroyed on unmount
  // (also covers React Strict Mode's double mount in development).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createTetrisGame(
      canvas,
      {
        onStats: setStats,
        onStatus: setStatus,
        onGameOver: setFinalStats,
      },
      { palette: SKINS[getLastSkin(gameId)] },
    );
    gameRef.current = game;
    game.start();

    return () => {
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
    // Skin changes never land here: they go through setSkin below.
  }, [gameId]);

  // Apply the active skin without recreating the engine.
  useEffect(() => {
    gameRef.current?.setSkin(SKINS[skin]);
  }, [skin]);

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
    // Release focus so Space (the hard-drop key) never targets the HUD button.
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

  const changeSkin = (next: SkinId) => {
    setChosenSkin(next);
    setLastSkin(gameId, next);
  };

  const handleSave = async (name: string) => {
    if (!finalStats) return;
    await saveScore({ gameId, name, score: finalStats.score, level: finalStats.level });
    setLastPlayerName(name);
  };

  const handleRestart = () => {
    setFinalStats(null);
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
        <SkinPicker value={skin} onChange={changeSkin} />
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
            className="tetris-canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-label={`${title}: ←/→ mover, ↑ o X rotar, ↓ bajar, Espacio caída instantánea`}
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
