import HomeView from "@/components/home/home-view";
import { getGames } from "@/lib/games";

export default async function Home() {
  const games = await getGames();
  return <HomeView games={games} />;
}
