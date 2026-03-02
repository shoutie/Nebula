import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertGameStats } from "@shared/types";

export function useStats(walletAddress?: string) {
  return useQuery({
    queryKey: [api.stats.get.path, walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;

      const url = new URL(api.stats.get.path, window.location.origin);
      url.searchParams.set('wallet', walletAddress);

      const res = await fetch(url.toString());
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
    enabled: !!walletAddress,
  });
}

export function useUpdateStats(walletAddress?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertGameStats) => {
      if (!walletAddress) throw new Error("Wallet address is required");

      const url = new URL(api.stats.update.path, window.location.origin);
      url.searchParams.set('wallet', walletAddress);

      const res = await fetch(url.toString(), {
        method: api.stats.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update stats");
      return api.stats.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path, walletAddress] });
    },
    enabled: !!walletAddress,
  });
}
