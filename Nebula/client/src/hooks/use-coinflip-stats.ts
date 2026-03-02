import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertCoinflipStats } from "@shared/routes";

export function useCoinflipStats(walletAddress?: string) {
  return useQuery({
    queryKey: [api.coinflipStats.get.path, walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;

      const url = new URL(api.coinflipStats.get.path, window.location.origin);
      url.searchParams.set('wallet', walletAddress);

      const res = await fetch(url.toString());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch coinflip stats");
      return api.coinflipStats.get.responses[200].parse(await res.json());
    },
    enabled: !!walletAddress,
  });
}

export function useUpdateCoinflipStats(walletAddress?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertCoinflipStats) => {
      if (!walletAddress) throw new Error("Wallet address is required");

      const url = new URL(api.coinflipStats.update.path, window.location.origin);
      url.searchParams.set('wallet', walletAddress);

      const res = await fetch(url.toString(), {
        method: api.coinflipStats.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update coinflip stats");
      return api.coinflipStats.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.coinflipStats.get.path, walletAddress] });
    },
    enabled: !!walletAddress,
  });
}