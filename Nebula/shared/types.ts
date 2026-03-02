export interface GameStats {
  id: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface InsertGameStats {
  wins?: number;
  losses?: number;
  draws?: number;
}

export type UpdateGameStatsRequest = Partial<InsertGameStats>;