/** Formats an ISO timestamp as dd/mm/yyyy for leaderboards. */
export function formatScoreDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Formats an ISO timestamp relative to `now` ("hace 5 min", "hace 3 h", "hace 2 d").
 * From 7 days on it falls back to the absolute dd/mm/yyyy date.
 * Pass `now` explicitly to keep a whole list consistent and the function testable.
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";

  // A timestamp slightly in the future (clock skew) reads as "just now".
  const elapsed = Math.max(0, now - time);

  if (elapsed < MINUTE) return "hace unos segundos";
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 7 * DAY) return `hace ${Math.floor(elapsed / DAY)} d`;
  return formatScoreDate(iso);
}
