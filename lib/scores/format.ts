/** Formats an ISO timestamp as dd/mm/yyyy for leaderboards. */
export function formatScoreDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}
