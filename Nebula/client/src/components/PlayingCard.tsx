import { motion, useAnimation } from "framer-motion";
import { useState, useEffect } from "react";
import { type Card } from "@/lib/blackjack";
import { cn } from "@/lib/utils";
import { Club, Diamond, Heart, Spade } from "lucide-react";

interface PlayingCardProps {
  card: Card;
  index: number;
  totalCards: number;
  highlight?: boolean;
  gameEnded?: boolean;
}

export function PlayingCard({ card, index, totalCards, highlight = false, gameEnded = false }: PlayingCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const [wasHidden, setWasHidden] = useState(card.isHidden);
  const [isNewCard, setIsNewCard] = useState(true);
  const controls = useAnimation();

  const SuitIcon = {
    spades: Spade,
    hearts: Heart,
    diamonds: Diamond,
    clubs: Club
  }[card.suit];

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const cardWidth = isMobile ? 96 : 128;
  const cardHeight = isMobile ? 144 : 192;
  const overlapOffset = cardWidth * 0.5;
  const gap = isMobile ? 10 : 14;
  const rowGap = isMobile ? 10 : 14;

  useEffect(() => {
    if (wasHidden && !card.isHidden) {
      controls.start({
        rotateY: [180, 0],
        transition: {
          duration: 0.2,
          ease: [0.9, 1, 1, 0.9]
        }
      });
      setWasHidden(false);
    } else if (!wasHidden && card.isHidden) {
      controls.start({
        rotateY: [0, 180],
        transition: {
          duration: 0.2,
          ease: [0.9, 1, 1, 0.9]
        }
      });
      setWasHidden(true);
    }
  }, [card.isHidden, wasHidden, controls]);

  useEffect(() => {
    const timer = setTimeout(() => setIsNewCard(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const overlapMargin = index > 0 ? -overlapOffset : 0;

  let spreadX = 0;
  let spreadY = 0;

  if (gameEnded) {
    const cardsPerRow = isMobile ? 3 : totalCards;
    const row = Math.floor(index / cardsPerRow);
    const col = index % cardsPerRow;
    const cardsInThisRow = Math.min(cardsPerRow, totalCards - row * cardsPerRow);

    const unstackedPos = (index - (totalCards - 1) / 2) * cardWidth;

    const targetPos = (col - (cardsInThisRow - 1) / 2) * (cardWidth + gap);

    spreadX = targetPos - unstackedPos;
    spreadY = row * (cardHeight + rowGap);
  }

  return (
    <motion.div
      initial={isNewCard ? { opacity: 0, x: 60, marginLeft: overlapMargin } : { marginLeft: overlapMargin }}
      animate={{
        opacity: 1,
        x: gameEnded ? spreadX : 0,
        y: gameEnded ? spreadY : 0,
        marginLeft: gameEnded ? 0 : overlapMargin,
      }}
      transition={{
        duration: gameEnded ? 0.7 : 0.2,
        ease: gameEnded ? [0.22, 1, 0.36, 1] : "easeOut",
        delay: gameEnded ? 0.05 + index * 0.08 : 0,
      }}
      style={{
        perspective: "1000px",
        zIndex: index,
      }}
      className="relative"
    >
      <motion.div
        animate={controls}
        initial={{ rotateY: card.isHidden ? 180 : 0 }}
        className={cn(
          "w-24 h-36 sm:w-32 sm:h-48 rounded-lg bg-white border border-gray-200 select-none preserve-3d cursor-pointer",
          "shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_10px_10px_-5px_rgba(0,0,0,0.4),0_0_20px_rgba(0,0,0,0.3)]",
          highlight && "shadow-[0_15px_35px_-5px_rgba(0,0,0,0.6),0_15px_15px_-5px_rgba(0,0,0,0.5),0_0_30px_rgba(0,0,0,0.4),0_0_0_3px_rgba(255,193,7,0.5),0_0_0_6px_rgba(255,193,7,0.3)] ring-2 ring-yellow-300"
        )}
        whileHover={{
          y: -4,
          transition: { duration: 0.2, ease: "easeOut" },
          cursor: "default"
        }}
        style={{
          transformStyle: "preserve-3d"
        }}
      >
        <div
          className="absolute inset-0 w-full h-full flex flex-col justify-between p-2 sm:p-3 backface-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex flex-col items-center w-6">
            <span className={cn("text-lg sm:text-2xl font-bold font-mono leading-none", isRed ? "text-red-600" : "text-gray-900")}>
              {card.rank}
            </span>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <SuitIcon className={cn("w-16 h-16 sm:w-24 sm:h-24", isRed ? "text-red-600" : "text-gray-900")} fill="currentColor" />
          </div>

          <div className="flex flex-col items-center w-6 self-end rotate-180">
             <span className={cn("text-lg sm:text-2xl font-bold font-mono leading-none", isRed ? "text-red-600" : "text-gray-900")}>
              {card.rank}
            </span>
          </div>
        </div>

        <div
          className="absolute inset-0 w-full h-full bg-white p-2 flex items-center justify-center rounded-lg backface-hidden"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)"
          }}
        >
          <div className="w-full h-full rounded-lg flex items-center justify-center bg-red-700 bg-grid-pattern">
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
