"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

export type VirtualKey = "up" | "down" | "left" | "right" | "space" | "enter" | "x";

// key / code dispatched for each virtual key. Engines listen on `window` and
// read either `key` (Arkanoid) or `code` (the rest), so both are sent.
const KEY_EVENTS: Record<VirtualKey, { key: string; code: string }> = {
  up: { key: "ArrowUp", code: "ArrowUp" },
  down: { key: "ArrowDown", code: "ArrowDown" },
  left: { key: "ArrowLeft", code: "ArrowLeft" },
  right: { key: "ArrowRight", code: "ArrowRight" },
  space: { key: " ", code: "Space" },
  enter: { key: "Enter", code: "Enter" },
  x: { key: "x", code: "KeyX" },
};

// Auto-repeat timing, close to a physical keyboard.
const REPEAT_DELAY_MS = 170;
const REPEAT_INTERVAL_MS = 50;

function dispatchKey(type: "keydown" | "keyup", vk: VirtualKey, repeat = false) {
  const { key, code } = KEY_EVENTS[vk];
  window.dispatchEvent(new KeyboardEvent(type, { key, code, repeat, bubbles: true, cancelable: true }));
}

/**
 * Press/release handling for one virtual button: keydown on press, keyup on
 * release (pointerup, pointercancel or lost capture), auto-repeat while held.
 * Each button tracks its own pointer, so several buttons work at once.
 */
function useVirtualKey(vk: VirtualKey) {
  const [pressed, setPressed] = useState(false);
  const pointerRef = useRef<number | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (delayRef.current !== null) clearTimeout(delayRef.current);
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    delayRef.current = null;
    intervalRef.current = null;
  }, []);

  const release = useCallback(() => {
    if (pointerRef.current === null) return;
    pointerRef.current = null;
    clearTimers();
    setPressed(false);
    dispatchKey("keyup", vk);
  }, [vk, clearTimers]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    // No focus, no text selection, no emulated mouse events.
    e.preventDefault();
    if (pointerRef.current !== null) return;
    pointerRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best effort; pointercancel still releases the key.
    }
    setPressed(true);
    dispatchKey("keydown", vk);
    delayRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => dispatchKey("keydown", vk, true), REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  };

  const onPointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId === pointerRef.current) release();
  };

  // Never leave a key stuck down if the gamepad unmounts mid-press.
  useEffect(() => release, [release]);

  return {
    pressed,
    handlers: {
      onPointerDown,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
    },
  };
}

interface PadButtonProps {
  vk: VirtualKey | null;
  className: string;
  label: string;
  children: ReactNode;
}

function PadButton({ vk, className, label, children }: PadButtonProps) {
  // A disabled button keeps a valid key for the hook; it never fires because
  // disabled buttons receive no pointer events.
  const { pressed, handlers } = useVirtualKey(vk ?? "space");
  const disabled = vk === null;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      className={pressed ? `${className} on` : className}
      {...(disabled ? {} : handlers)}
    >
      {children}
    </button>
  );
}

function Arrow({ d }: { d: string }) {
  return (
    <svg className="dp-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

interface VirtualGamepadProps {
  /** Key for button A; null disables it. B is always "space". */
  actionA: VirtualKey | null;
}

/** Touch gamepad (D-pad + B + A) that emulates the keyboard. Mobile only. */
export default function VirtualGamepad({ actionA }: VirtualGamepadProps) {
  return (
    <div
      className="gp"
      role="group"
      aria-label="Mando virtual"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="gp-body">
        <div className="gp-dpad">
          <PadButton vk="up" className="dp dp-up" label="Arriba">
            <Arrow d="M12 4 L20 16 L4 16 Z" />
          </PadButton>
          <PadButton vk="right" className="dp dp-right" label="Derecha">
            <Arrow d="M8 4 L20 12 L8 20 Z" />
          </PadButton>
          <PadButton vk="down" className="dp dp-down" label="Abajo">
            <Arrow d="M4 8 L20 8 L12 20 Z" />
          </PadButton>
          <PadButton vk="left" className="dp dp-left" label="Izquierda">
            <Arrow d="M16 4 L16 20 L4 12 Z" />
          </PadButton>
          <div className="dp-hub" aria-hidden="true">
            <span className="dp-hub-gem" />
          </div>
        </div>
        <div className="gp-actions">
          <PadButton vk="space" className="ab b" label="B">
            <span className="ab-ring" />
            <span className="ab-letter">B</span>
          </PadButton>
          <PadButton vk={actionA} className="ab a" label="A">
            <span className="ab-ring" />
            <span className="ab-letter">A</span>
          </PadButton>
        </div>
      </div>
    </div>
  );
}
