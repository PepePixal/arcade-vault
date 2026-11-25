type PauseOverlayProps = {
  visible: boolean;
};

/** "Pausa" label drawn over the game canvas while the game is paused. */
export default function PauseOverlay({ visible }: PauseOverlayProps) {
  if (!visible) return null;
  return (
    <div className="pause-overlay" role="status" aria-live="polite">
      Pausa
    </div>
  );
}
