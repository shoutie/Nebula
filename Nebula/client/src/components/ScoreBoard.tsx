import { GameStats } from "@shared/types";
import { Trophy, XCircle, MinusCircle } from "lucide-react";

interface ScoreBoardProps {
  stats: GameStats | undefined | null;
}

export function ScoreBoard({ stats }: ScoreBoardProps) {
  const wins = stats?.wins || 0;
  const losses = stats?.losses || 0;
  const draws = stats?.draws || 0;
  
  return (
    <div className="grid grid-cols-3 mt-5 p-2 bg-gradient-to-r from-black/30 via-black/20 to-black/30 backdrop-blur-sm border border-white/10 max-w-lg mx-auto w-full rounded-2xl gap-2 shadow-lg shadow-black/70">
      <div className="flex flex-col items-center">
        <span className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1 flex items-center gap-1">
          Wins
        </span>
        <span className="text-lg md:text-xl font-mono font-bold text-white">{wins}</span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
          Draws
        </span>
        <span className="text-lg md:text-xl font-mono font-bold text-white">{draws}</span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
          Losses
        </span>
        <span className="text-lg md:text-xl font-mono font-bold text-white">{losses}</span>
      </div>
    </div>
  );
}
