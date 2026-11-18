"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Shown when a page fails to load data (for example, when Supabase is unreachable
// while reading the game catalog). `retry` re-fetches and re-renders the segment.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fade-in" style={{ padding: "64px 16px", textAlign: "center" }}>
      <div className="lb-empty">
        <p className="lb-empty-title">No se pudo cargar la información</p>
        <p>Comprueba tu conexión e inténtalo de nuevo.</p>
        <button type="button" className="btn" onClick={() => retry()}>
          REINTENTAR
        </button>
      </div>
    </div>
  );
}
