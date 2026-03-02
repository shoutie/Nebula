import { Button } from "@/components/ui/button";
import { GameStatus } from "@/lib/blackjack";
import { motion } from "framer-motion";
import { Play, Hand, RefreshCw, Plus, Shuffle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from "@/components/WalletButton";

interface GameControlsProps {
  status: GameStatus;
  onHit: () => void;
  onStand: () => void;
  onNewGame: () => void;
  onDealCards: () => void;
  disabled: boolean;
  newGameDisabled: boolean;
  isSendingTransaction?: boolean;
  mainButtonPhase: 'hit' | 'dealer_play' | 'resolve';
  sendingPhase: 'none' | 'deal' | 'hit' | 'stand' | 'dealer_play' | 'resolve';
}

export function GameControls({
  status,
  onHit,
  onStand,
  onNewGame,
  onDealCards,
  disabled,
  newGameDisabled,
  isSendingTransaction,
  mainButtonPhase,
  sendingPhase,
}: GameControlsProps) {
  const { publicKey, disconnect } = useWallet();
  const isWalletConnected = !!publicKey;
  const isGameOver = status !== 'playing';
  const isWaitingToDeal = status === 'waiting_to_deal';
  const mainDisabled = isGameOver ? newGameDisabled : disabled;

  let mainLabel: string;
  let mainIconKey: string;
  let MainIcon = Plus;
   let showMainIcon = true;

  if (isGameOver) {
    mainLabel = 'New Game';
    mainIconKey = 'refresh';
    MainIcon = RefreshCw;
  } else {
    switch (mainButtonPhase) {
      case 'dealer_play':
        mainLabel = 'Dealer Play';
        if (sendingPhase === 'dealer_play') {
          mainIconKey = 'loader-dealer';
          MainIcon = Loader2;
        } else {
          mainIconKey = 'empty-dealer';
          showMainIcon = false;
        }
        break;
      case 'resolve':
        mainLabel = 'Resolve Game';
        if (sendingPhase === 'resolve') {
          mainIconKey = 'loader-resolve';
          MainIcon = Loader2;
        } else {
          mainIconKey = 'empty-resolve';
          showMainIcon = false;
        }
        break;
      case 'hit':
      default:
        mainLabel = 'Hit';
        mainIconKey = sendingPhase === 'hit' ? 'loader-hit' : 'plus';
        MainIcon = sendingPhase === 'hit' ? Loader2 : Plus;
        break;
    }
  }

  if (!isWalletConnected) {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.1 }}
        >
          <WalletButton />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0 mt-0">
      <div className="flex flex-wrap justify-center gap-4">
      {isWaitingToDeal && (
        <motion.div
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          whileHover={isSendingTransaction ? {} : { scale: 1.00 }}
          whileTap={isSendingTransaction ? {} : { scale: 0.97 }}
        >
          <Button
            onClick={onDealCards}
            disabled={disabled}
            className={cn(
              "duration-100 border border-purple-600/50 text-white text-lg px-8 py-6 backdrop-blur-sm shadow-lg shadow-black/70 disabled:text-white disabled:opacity-100",
              sendingPhase === 'deal'
                ? "bg-purple-500/20"
                : "bg-purple-500/20 hover:bg-purple-800/30"
            )}
          >
            <motion.div
              key={sendingPhase === 'deal' ? 'loader-deal' : 'shuffle'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-5 w-5 inline-flex"
            >
              {sendingPhase === 'deal' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Shuffle />
              )}
            </motion.div>
            <motion.span
              key={sendingPhase === 'deal' ? 'dealing' : 'deal'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ml-1"
            >
              {sendingPhase === 'deal' ? 'Dealing Cards' : 'Deal Cards'}
            </motion.span>
          </Button>
        </motion.div>
      )}

      {!isWaitingToDeal && (
        <motion.div
          layout
          transition={{ duration: 0.1, ease: "easeInOut" }}
          whileHover={isGameOver ? { scale: 1.00 } : isSendingTransaction ? {} : { scale: 1.00 }}
          whileTap={isGameOver ? { scale: 0.97 } : isSendingTransaction ? {} : { scale: 0.97 }}
        >
          <Button
            onClick={isGameOver ? onNewGame : onHit}
            disabled={mainDisabled}
            className={cn(
              "text-white text-lg px-8 py-6 transition-colors duration-100 backdrop-blur-sm shadow-lg shadow-black/70",
              isGameOver
                ? "bg-green-500/20 hover:bg-green-800/30 border border-green-600/50"
                : "bg-green-500/20 hover:bg-green-800/30 border border-green-600/50",
              (sendingPhase === 'hit' ||
                sendingPhase === 'dealer_play' ||
                sendingPhase === 'resolve') &&
                "disabled:opacity-100"
            )}
          >
            {showMainIcon && (
              <motion.div
                key={mainIconKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="-mr-3 h-5 w-5 inline-flex"
              >
                <MainIcon
                  className={
                    !isGameOver &&
                    (sendingPhase === 'hit' ||
                      sendingPhase === 'dealer_play' ||
                      sendingPhase === 'resolve') &&
                    MainIcon === Loader2
                      ? "animate-spin"
                      : ""
                  }
                />
              </motion.div>
            )}
            <motion.span
              key={mainLabel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, delay: 0.1 }}
              className="ml-2"
            >
              {mainLabel}
            </motion.span>
          </Button>
        </motion.div>
      )}

      {!isWaitingToDeal && !isGameOver && mainButtonPhase === 'hit' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          whileHover={isSendingTransaction ? {} : { scale: 1.00 }}
          whileTap={isSendingTransaction ? {} : { scale: 0.97 }}
        >
          <Button
            onClick={onStand}
            disabled={disabled}
            variant="secondary"
            className={cn(
              "bg-blue-500/20 hover:bg-blue-800/30 duration-100 border border-blue-600/50 text-white text-lg px-8 py-6 backdrop-blur-sm shadow-lg shadow-black/70",
              sendingPhase === 'stand' && "disabled:opacity-100"
            )}
          >
            {sendingPhase === 'stand' ? (
              <Loader2 className="mr-0 h-5 w-5 animate-spin" />
            ) : (
              <Hand className="mr-0 h-5 w-5" />
            )}{" "}
            Stand
          </Button>
        </motion.div>
      )}
      </div>
    </div>
  );
}
