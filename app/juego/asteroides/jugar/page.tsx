import { notFound } from "next/navigation";
import { GAMES } from "@/lib/data";
import AsteroidsPlayer from "../asteroids-player";

const GAME_ID = "asteroides";

export default function AsteroidsPlayerPage() {
  const game = GAMES.find((g) => g.id === GAME_ID);
  if (!game) notFound();

  return (
    <div className="av-player fade-in">
      <AsteroidsPlayer gameId={game.id} title={game.title} />
    </div>
  );
}
