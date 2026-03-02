import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { CoinflipStats } from "@shared/routes";

export function useCoinflipLeaderboard() {
  return useQuery({
    queryKey: [api.coinflipLeaderboard.get.path],
    queryFn: async () => {
      const res = await fetch(api.coinflipLeaderboard.get.path);
      if (!res.ok) throw new Error("Failed to fetch coinflip leaderboard");
      return api.coinflipLeaderboard.get.responses[200].parse(await res.json());
    },
  });
}