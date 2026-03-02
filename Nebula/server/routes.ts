import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.stats.get.path, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      if (!walletAddress) {
        return res.status(400).json({ message: 'wallet parameter is required' });
      }

      const stats = await storage.getStats(walletAddress);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post(api.stats.update.path, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      if (!walletAddress) {
        return res.status(400).json({ message: 'wallet parameter is required' });
      }

      const input = api.stats.update.input.parse(req.body);
      const stats = await storage.updateStats(walletAddress, input);
      res.json(stats);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get(api.coinflipStats.get.path, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      if (!walletAddress) {
        return res.status(400).json({ message: 'wallet parameter is required' });
      }

      const stats = await storage.getCoinflipStats(walletAddress);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post(api.coinflipStats.update.path, async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      if (!walletAddress) {
        return res.status(400).json({ message: 'wallet parameter is required' });
      }

      const input = api.coinflipStats.update.input.parse(req.body);
      const stats = await storage.updateCoinflipStats(walletAddress, input);
      res.json(stats);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get(api.leaderboard.get.path, async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (err) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get(api.coinflipLeaderboard.get.path, async (req, res) => {
    try {
      const leaderboard = await storage.getCoinflipLeaderboard();
      res.json(leaderboard);
    } catch (err) {
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return httpServer;
}
