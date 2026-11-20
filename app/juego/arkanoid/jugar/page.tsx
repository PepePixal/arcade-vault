import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import ArkanoidPlayer from "../arkanoid-player";

const GAME_ID = "arkanoid";

export default async function ArkanoidPlayerPage() {
  const game = await getGame(GAME_ID);
  if (!game) notFound();

  return (
    <div className="av-player fade-in">
      <ArkanoidPlayer gameId={game.id} title={game.title} />
    </div>
  );
}
