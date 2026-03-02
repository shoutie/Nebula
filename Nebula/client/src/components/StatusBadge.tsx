import { GameStatus } from "@/lib/blackjack";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatusBadgeProps {
  status: GameStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'playing' || status !== 'push') return null;

  let text = "";
  let colorClass = "";

  switch (status) {
    case 'push':
      text = "TIE";
      colorClass = "text-gray-300";
      break;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "absolute inset-0 flex justify-center items-center text-center bottom-7",
        colorClass
      )}
    >
      <h2 className="text-3xl md:text-4xl font-bold tracking-wider whitespace-nowrap">
        {text}
      </h2>
    </motion.div>
  );
}
