"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import GameOverModal from "@/components/games/game-over-modal";
import MobileGameControls from "@/components/games/mobile-game-controls";
import MobileStatsBar from "@/components/games/mobile-stats-bar";
import SkinPicker from "@/components/games/skin-picker";
import {
  createArkanoidGame,
  type ArkanoidGame,
  type ArkanoidStats,
  type ArkanoidStatus,
} from "./engine";
import { SKINS } from "./skins";
import { saveScore, setLastPlayerName } from "@/lib/scores";
import { getLastSkin, setLastSkin, type SkinId } from "@/lib/skins";
import type { VirtualKey } from "@/components/games/virtual-gamepad";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const INITIAL_STATS: ArkanoidStats = { score: 0, lives: 3, level: 1 };

// Virtual gamepad button A: launch the ball (same as the Enter key).
const ACTION_A: VirtualKey = "enter";

// Keys the game uses that would otherwise scroll the page.
const SCROLL_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// The stored skin never changes behind our back, so there is nothing to subscribe to.
const noSubscribe = () => () => {};

interface ArkanoidPlayerProps {
  gameId: string;
  title: string;
}

export default function ArkanoidPlayer({ gameId, title }: ArkanoidPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ArkanoidGame | null>(null);
  const [stats, setStats] = useState<ArkanoidStats>(INITIAL_STATS);
  const [status, setStatus] = useState<ArkanoidStatus>("playing");
  const [finalStats, setFinalStats] = useState<ArkanoidStats | null>(null);
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

    const game = createArkanoidGame(
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

  // Shared by the desktop HUD and the mobile controls (no event needed).
  const pauseOrResume = () => {
    const game = gameRef.current;
    if (!game) return;
    if (isPaused) game.resume();
    else game.pause();
  };

  const finishGame = () => {
    gameRef.current?.end();
  };

  const togglePause = (e: MouseEvent<HTMLButtonElement>) => {
    // Release focus so Space (the launch key) never targets the HUD button.
    e.currentTarget.blur();
    pauseOrResume();
  };

  const endGame = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    finishGame();
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
      <div className="player-hud max-md:hidden!">
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

      <MobileStatsBar score={stats.score} lives={stats.lives} level={stats.level} />

      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            className="arkanoid-canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-label={`${title}: ratón o A/D para mover la paleta, clic, Espacio o Enter para lanzar la bola`}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <MobileGameControls
        actionA={ACTION_A}
        skin={skin}
        onSkinChange={changeSkin}
        isPaused={isPaused}
        isGameOver={isGameOver}
        onTogglePause={pauseOrResume}
        onEnd={finishGame}
      />

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
