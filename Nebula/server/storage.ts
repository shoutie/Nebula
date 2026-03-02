import { Pool } from 'pg';

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

export interface IStorage {
  getStats(walletAddress: string): Promise<GameStats>;
  updateStats(walletAddress: string, stats: InsertGameStats): Promise<GameStats>;
  getCoinflipStats(walletAddress: string): Promise<CoinflipStats>;
  updateCoinflipStats(walletAddress: string, stats: InsertCoinflipStats): Promise<CoinflipStats>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getCoinflipLeaderboard(): Promise<CoinflipStats[]>;
}

export class MemoryStorage implements IStorage {
  private stats: Map<string, GameStats> = new Map();
  private coinflipStats: Map<string, CoinflipStats> = new Map();

  private getStatsForWallet(walletAddress: string): GameStats {
    if (!this.stats.has(walletAddress)) {
      this.stats.set(walletAddress, {
        id: 1,
        wins: 0,
        losses: 0,
        draws: 0
      });
    }
    return { ...this.stats.get(walletAddress)! };
  }

  private getCoinflipStatsForWallet(walletAddress: string): CoinflipStats {
    if (!this.coinflipStats.has(walletAddress)) {
      const now = new Date().toISOString();
      this.coinflipStats.set(walletAddress, {
        wallet_address: walletAddress,
        wins: 0,
        losses: 0,
        created_at: now,
        updated_at: now
      });
    }
    return { ...this.coinflipStats.get(walletAddress)! };
  }

  async getStats(walletAddress: string): Promise<GameStats> {
    return this.getStatsForWallet(walletAddress);
  }

  async updateStats(walletAddress: string, stats: InsertGameStats): Promise<GameStats> {
    const currentStats = this.getStatsForWallet(walletAddress);

    if (stats.wins !== undefined) currentStats.wins = stats.wins;
    if (stats.losses !== undefined) currentStats.losses = stats.losses;
    if (stats.draws !== undefined) currentStats.draws = stats.draws;

    this.stats.set(walletAddress, currentStats);
    return { ...currentStats };
  }

  async getCoinflipStats(walletAddress: string): Promise<CoinflipStats> {
    return this.getCoinflipStatsForWallet(walletAddress);
  }

  async updateCoinflipStats(walletAddress: string, stats: InsertCoinflipStats): Promise<CoinflipStats> {
    const currentStats = this.getCoinflipStatsForWallet(walletAddress);

    if (stats.wins !== undefined) currentStats.wins += stats.wins;
    if (stats.losses !== undefined) currentStats.losses += stats.losses;

    currentStats.updated_at = new Date().toISOString();

    this.coinflipStats.set(walletAddress, currentStats);
    return { ...currentStats };
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return [];
  }

  async getCoinflipLeaderboard(): Promise<CoinflipStats[]> {
    return [];
  }
}

export class PostgreSQLStorage implements IStorage {
  private pool: Pool;

  constructor() {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }

    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'nebula',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('connect', () => {
      console.log('Connected to PostgreSQL database');
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async getStats(walletAddress: string): Promise<GameStats> {
    try {
      const result = await this.pool.query(
        'SELECT wins, losses, draws FROM game_stats WHERE wallet_address = $1',
        [walletAddress]
      );

      if (result.rows.length === 0) {
        await this.pool.query(
          'INSERT INTO game_stats (wallet_address, wins, losses, draws) VALUES ($1, $2, $3, $4)',
          [walletAddress, 0, 0, 0]
        );
        return {
          id: 1,
          wins: 0,
          losses: 0,
          draws: 0
        };
      }

      const row = result.rows[0];
      return {
        id: 1,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws
      };
    } catch (error) {
      throw error;
    }
  }

  async updateStats(walletAddress: string, stats: InsertGameStats): Promise<GameStats> {
    try {
      await this.getStats(walletAddress);

      const updates: string[] = [];
      const values: any[] = [walletAddress];
      let paramIndex = 2;

      if (stats.wins !== undefined) {
        updates.push(`wins = wins + $${paramIndex}`);
        values.push(stats.wins);
        paramIndex++;
      }

      if (stats.losses !== undefined) {
        updates.push(`losses = losses + $${paramIndex}`);
        values.push(stats.losses);
        paramIndex++;
      }

      if (stats.draws !== undefined) {
        updates.push(`draws = draws + $${paramIndex}`);
        values.push(stats.draws);
        paramIndex++;
      }

      if (updates.length === 0) {
        return this.getStats(walletAddress);
      }

      const updateQuery = `
        UPDATE game_stats
        SET ${updates.join(', ')}
        WHERE wallet_address = $1
        RETURNING wins, losses, draws
      `;

      const result = await this.pool.query(updateQuery, values);

      const row = result.rows[0];
      return {
        id: 1,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws
      };
    } catch (error) {
      throw error;
    }
  }

  async getCoinflipStats(walletAddress: string): Promise<CoinflipStats> {
    try {
      const result = await this.pool.query(
        'SELECT wallet_address, wins, losses FROM coinflip_stats WHERE wallet_address = $1',
        [walletAddress]
      );

      if (result.rows.length === 0) {
        await this.pool.query(
          'INSERT INTO coinflip_stats (wallet_address, wins, losses) VALUES ($1, $2, $3)',
          [walletAddress, 0, 0]
        );
        return {
          wallet_address: walletAddress,
          wins: 0,
          losses: 0
        };
      }

      const row = result.rows[0];
      return {
        wallet_address: row.wallet_address,
        wins: row.wins,
        losses: row.losses,
        created_at: row.created_at?.toISOString(),
        updated_at: row.updated_at?.toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  async updateCoinflipStats(walletAddress: string, stats: InsertCoinflipStats): Promise<CoinflipStats> {
    try {
      await this.getCoinflipStats(walletAddress);

      const updates: string[] = [];
      const values: any[] = [walletAddress];
      let paramIndex = 2;

      if (stats.wins !== undefined) {
        updates.push(`wins = wins + $${paramIndex}`);
        values.push(stats.wins);
        paramIndex++;
      }

      if (stats.losses !== undefined) {
        updates.push(`losses = losses + $${paramIndex}`);
        values.push(stats.losses);
        paramIndex++;
      }

      if (updates.length === 0) {
        return this.getCoinflipStats(walletAddress);
      }

      const updateQuery = `
        UPDATE coinflip_stats
        SET ${updates.join(', ')}
        WHERE wallet_address = $1
        RETURNING wallet_address, wins, losses, created_at, updated_at
      `;

      const result = await this.pool.query(updateQuery, values);

      const row = result.rows[0];
      return {
        wallet_address: row.wallet_address,
        wins: row.wins,
        losses: row.losses,
        created_at: row.created_at?.toISOString(),
        updated_at: row.updated_at?.toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const result = await this.pool.query(
        'SELECT wallet_address, wins, losses, draws FROM game_stats ORDER BY wins DESC, losses ASC, draws DESC'
      );

      return result.rows.map(row => ({
        wallet_address: row.wallet_address,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws
      }));
    } catch (error) {
      throw error;
    }
  }

  async getCoinflipLeaderboard(): Promise<CoinflipStats[]> {
    try {
      const result = await this.pool.query(
        'SELECT wallet_address, wins, losses FROM coinflip_stats ORDER BY wins DESC, losses ASC'
      );

      return result.rows.map(row => ({
        wallet_address: row.wallet_address,
        wins: row.wins,
        losses: row.losses
      }));
    } catch (error) {
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

const useMemoryStorage = process.env.USE_MEMORY_STORAGE === 'true';
export const storage = useMemoryStorage
  ? new MemoryStorage()
  : new PostgreSQLStorage();