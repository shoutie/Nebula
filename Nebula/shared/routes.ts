import { z } from 'zod';

export interface GameStats {
  id: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface CoinflipStats {
  wallet_address: string;
  wins: number;
  losses: number;
  created_at?: string;
  updated_at?: string;
}

export interface LeaderboardEntry {
  wallet_address: string;
  wins: number;
  losses: number;
  draws: number;
}

export interface InsertGameStats {
  wins?: number;
  losses?: number;
  draws?: number;
}

export interface InsertCoinflipStats {
  wins?: number;
  losses?: number;
}

export type UpdateGameStatsRequest = Partial<InsertGameStats>;

export const gameStatsSchema = z.object({
  id: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
});

export const coinflipStatsSchema = z.object({
  wallet_address: z.string(),
  wins: z.number(),
  losses: z.number(),
});

export const leaderboardEntrySchema = z.object({
  wallet_address: z.string(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
});

export const insertGameStatsSchema = z.object({
  wins: z.number().optional(),
  losses: z.number().optional(),
  draws: z.number().optional(),
});

export const insertCoinflipStatsSchema = z.object({
  wins: z.number().optional(),
  losses: z.number().optional(),
});

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: gameStatsSchema,
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/stats',
      input: insertGameStatsSchema,
      responses: {
        200: gameStatsSchema,
      },
    },
  },
  coinflipStats: {
    get: {
      method: 'GET' as const,
      path: '/api/coinflip-stats',
      responses: {
        200: coinflipStatsSchema,
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/coinflip-stats',
      input: insertCoinflipStatsSchema,
      responses: {
        200: coinflipStatsSchema,
      },
    },
  },
  leaderboard: {
    get: {
      method: 'GET' as const,
      path: '/api/leaderboard',
      responses: {
        200: z.array(leaderboardEntrySchema),
      },
    },
  },
  coinflipLeaderboard: {
    get: {
      method: 'GET' as const,
      path: '/api/coinflip-leaderboard',
      responses: {
        200: z.array(coinflipStatsSchema),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
