import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import AsteroidsPlayer from "../asteroids-player";

const GAME_ID = "asteroides";

export default async function AsteroidsPlayerPage() {
  const game = await getGame(GAME_ID);
  if (!game) notFound();

  return (
    <div className="av-player fade-in">
      <AsteroidsPlayer gameId={game.id} title={game.title} />
    </div>
  );
}
