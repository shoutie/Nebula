import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useStats, useUpdateStats } from "@/hooks/use-stats";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { queryClient } from "@/lib/queryClient";
import {
  calculateScore,
  type Card,
  type GameStatus,
  type Suit,
  type Rank,
} from "@/lib/blackjack";
import { BlackjackClient, type GameResult } from "@/lib/blackjack-client";
import { PlayingCard } from "@/components/PlayingCard";
import AsciiClouds from "@/components/AsciiClouds";
import { cn } from "@/lib/utils";
import { GameControls } from "@/components/GameControls";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreBoard } from "@/components/ScoreBoard";
import { TransactionLink } from "@/components/TransactionLink";
import { WalletInfo } from "@/components/WalletInfo";
import { ChevronDown, HelpCircle, Trophy, Copy, Check } from "lucide-react";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function placeholderHand(count: number): Card[] {
  return Array.from({ length: count }, () => ({
    suit: 'spades' as Suit,
    rank: 'A' as Rank,
    value: 11,
    isHidden: true,
  }));
}

export default function Game() {
  const [, setLocation] = useLocation();

  const asciiCloudsSettings = {
    cellSize: 5,
    waveAmplitude: 0.1,
    waveSpeed: 0,
    noiseIntensity: 0.05,
    vignetteIntensity: 0,
    vignetteRadius: 0,
    brightnessAdjust: 0,
    contrastAdjust: 0.75,
    timeSpeed: 0.3,
    hue: 265,
    saturation: 1,
    threshold1: 0.1,
    threshold2: 0,
    threshold3: 0.7,
    threshold4: 0.8,
    threshold5: 1,
    noiseSeed: 'jmzcyi',
  };

  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>(placeholderHand(2));
  const [dealerHand, setDealerHand] = useState<Card[]>(placeholderHand(2));
  const [status, setStatus] = useState<GameStatus>('waiting_to_deal');
  const [isDealing, setIsDealing] = useState(false);
  const [isStartingNewGame, setIsStartingNewGame] = useState(false);
  const [gameEnding, setGameEnding] = useState(false);
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [mainButtonPhase, setMainButtonPhase] = useState<'hit' | 'dealer_play' | 'resolve'>('hit');
  const [sendingPhase, setSendingPhase] = useState<'none' | 'deal' | 'hit' | 'stand' | 'dealer_play' | 'resolve'>('none');
  const [gameId, setGameId] = useState<number>(0);
  const [transactionSignatures, setTransactionSignatures] = useState<string[]>([]);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [isGameDropdownOpen, setIsGameDropdownOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  const [isLeaderboardButtonPressed, setIsLeaderboardButtonPressed] = useState(false);
  const [isHelpButtonPressed, setIsHelpButtonPressed] = useState(false);
  const [isDropdownButtonHovered, setIsDropdownButtonHovered] = useState(false);
  const [isXButtonHovered, setIsXButtonHovered] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasTwitterInitialized, setHasTwitterInitialized] = useState(false);
  const [isTwitterDropdownOpen, setIsTwitterDropdownOpen] = useState(false);
  const [dropdownType, setDropdownType] = useState<'game' | 'twitter'>('game');
  const [lastClickedButton, setLastClickedButton] = useState<'dropdown' | 'x' | null>(null);
  const [copiedAddresses, setCopiedAddresses] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const twitterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGameDropdownOpen(false);
      }
    };

    if (isGameDropdownOpen && window.innerWidth >= 768) {
      document.addEventListener('click', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isGameDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (twitterDropdownRef.current && !twitterDropdownRef.current.contains(event.target as Node)) {
        setIsTwitterDropdownOpen(false);
      }
    };

    if (isTwitterDropdownOpen && window.innerWidth >= 768) {
      document.addEventListener('click', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isTwitterDropdownOpen]);

  const { wallet, connected, publicKey } = useWallet();
  const { connection } = useConnection();

  const [blackjackClient, setBlackjackClient] = useState<BlackjackClient | null>(null);

  const { data: stats, isLoading } = useStats(publicKey?.toString());
  const updateStats = useUpdateStats(publicKey?.toString());
  const { data: leaderboard, isLoading: isLeaderboardLoading, refetch: refetchLeaderboard } = useLeaderboard();

  useEffect(() => {
    if (isLeaderboardModalOpen) {
      refetchLeaderboard();
    }
  }, [isLeaderboardModalOpen, refetchLeaderboard]);

  useEffect(() => {
    if (!isSecurityModalOpen) {
      setIsHelpButtonPressed(false);
    }
    if (!isLeaderboardModalOpen) {
      setIsLeaderboardButtonPressed(false);
    }
  }, [isSecurityModalOpen, isLeaderboardModalOpen]);

  useEffect(() => {
    if (!connected) {
      setTransactionSignatures([]);
      setTransactionError(null);
      setIsSendingTransaction(false);
      setSendingPhase('none');
    }
  }, [connected]);

  useEffect(() => {
    if (connected && publicKey && wallet && connection) {
      try {
        const client = new BlackjackClient(connection, wallet as any);
        setBlackjackClient(client);
      } catch (error) {
        setBlackjackClient(null);
      }
    } else {
      setBlackjackClient(null);
    }
  }, [connected, publicKey, wallet, connection]);

  useEffect(() => {
    const newGameId = Date.now();
    setGameId(newGameId);
    const playerPlaceholders = placeholderHand(2);
    const dealerPlaceholders = placeholderHand(2);
    setPlayerHand(playerPlaceholders);
    setDealerHand(dealerPlaceholders);
    setMainButtonPhase('hit');
    setSendingPhase('none');
  }, []);

  const blockchainResultToGameStatus = (blockchainWinner: 'Player' | 'Dealer' | 'Tie'): GameStatus => {
    switch (blockchainWinner) {
      case 'Player': return 'player_win';
      case 'Dealer': return 'dealer_win';
      case 'Tie': return 'push';
      default: return 'push';
    }
  };

  const startNewGame = useCallback(() => {
    setIsStartingNewGame(true);
    setGameEnding(false);

    const newGameId = Date.now();
    setGameId(newGameId);

    const playerPlaceholders = placeholderHand(2);
    const dealerPlaceholders = placeholderHand(2);
    setPlayerHand(playerPlaceholders);
    setDealerHand(dealerPlaceholders);
    setDeck([]);
    setStatus('waiting_to_deal');
    setIsDealing(false);
    setIsSendingTransaction(false);
    setTransactionSignatures([]);
    setTransactionError(null);
    setMainButtonPhase('hit');

    setTimeout(() => setIsStartingNewGame(false), 100);
  }, []);

  const dealCards = useCallback(async () => {
    if (!connected || !publicKey) {
      return;
    }
    if (!blackjackClient) {
      return;
    }

    try {
      setIsSendingTransaction(true);
      setGameEnding(false);
      setSendingPhase('deal');

      const dealResult = await blackjackClient.initializeGame(gameId);

      setTransactionSignatures(prev => [...prev, dealResult.signature]);
      setTransactionError(null);
      setIsSendingTransaction(false);
      setSendingPhase('none');
      setIsDealing(true);

      const revealedPlayerHand = dealResult.playerHand.map(c => ({ ...c, isHidden: false }));
      const revealedDealerHand: Card[] = [
        { ...dealResult.dealerFaceUpCard, isHidden: false },
        { suit: 'spades' as Suit, rank: 'A' as Rank, value: 11, isHidden: true },
      ];

      setPlayerHand(revealedPlayerHand);
      setDealerHand(revealedDealerHand);
      setStatus('playing');
      setMainButtonPhase('hit');

      setTimeout(() => setIsDealing(false), 300);
    } catch (error) {
      setIsSendingTransaction(false);
      setIsDealing(false);
      setTransactionError("Transaction failed");
      setTransactionSignatures([]);
      setSendingPhase('none');
      hideAllCards();
      resetGameOnError();
    }
  }, [blackjackClient, gameId]);

  const completeGameFlow = async (
    preliminaryResult: GameStatus,
    currentPlayerHand: Card[],
    currentDealerHand: Card[],
    needsStand: boolean = false,
    isBust: boolean = false
  ) => {
    let revealedDealerCards: Card[] | null = null;

    try {
      setIsDealing(true);

      if (needsStand) {
        await blackjackClient!.playerStand(gameId);
      }

      setMainButtonPhase('dealer_play');
      setIsSendingTransaction(true);
      setSendingPhase('dealer_play');
      const dealerResult = await blackjackClient!.dealerPlay(gameId);
      setTransactionSignatures(prev => [...prev, dealerResult.signature]);
      setIsSendingTransaction(false);
      setSendingPhase('none');

      revealedDealerCards = dealerResult.dealerHand.map(c => ({ ...c, isHidden: false }));

      const existingCount = currentDealerHand.length;

      let finalDealerHand = currentDealerHand.map((c, i) => {
        if (c.isHidden && i < revealedDealerCards!.length) {
          return { ...revealedDealerCards![i], isHidden: false };
        }
        return c;
      });
      setDealerHand(finalDealerHand);

      if (!isBust) {
        for (let i = existingCount; i < revealedDealerCards!.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 800));
          const newCard = { ...revealedDealerCards![i], isHidden: false };
          finalDealerHand = [...finalDealerHand, newCard];
          setDealerHand(finalDealerHand);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setMainButtonPhase('resolve');
      setIsSendingTransaction(true);
      setSendingPhase('resolve');
      const resolveResult = await blackjackClient!.resolveGame(gameId);
      const resolveSignature = blackjackClient!.getLastTransactionSignature();
      if (resolveSignature) setTransactionSignatures(prev => [...prev, resolveSignature]);
      setIsSendingTransaction(false);
      setSendingPhase('none');

      const gameStatus = blockchainResultToGameStatus(resolveResult.winner);
      handleGameOver(gameStatus, currentPlayerHand, finalDealerHand, 500);
      setIsDealing(false);
    } catch (error) {
      console.error('Error in game flow completion:', error);
      setIsDealing(false);
      setTransactionError("Transaction failed");
      setTransactionSignatures([]);
      setIsSendingTransaction(false);
      setSendingPhase('none');
      hideAllCards();
      resetGameOnError();
    }
  };

  const handleHit = async () => {
    if (status !== 'playing' || !connected || !publicKey || !blackjackClient) return;

    try {
      setIsSendingTransaction(true);
      setSendingPhase('hit');

      const hitResult = await blackjackClient.playerHit(gameId);

      setTransactionSignatures(prev => [...prev, hitResult.signature]);
      setTransactionError(null);
      setIsSendingTransaction(false);
      setSendingPhase('none');

      const blockchainCards = hitResult.playerHand.map(c => ({ ...c, isHidden: false }));
      const newCard = blockchainCards[blockchainCards.length - 1];
      const updatedHand = [...playerHand, newCard];
      setPlayerHand(updatedHand);

      if (hitResult.isBust) {
        setMainButtonPhase('dealer_play');
        await completeGameFlow('player_bust', updatedHand, dealerHand, false, true);
        return;
      }

    } catch (error) {
      setIsSendingTransaction(false);
      setTransactionError("Transaction failed");
      setTransactionSignatures([]);
      setSendingPhase('none');
      hideAllCards();
      resetGameOnError();
    }
  };

  const handleStand = async () => {
    if (status !== 'playing' || !connected || !publicKey || !blackjackClient) return;

    try {
      setIsSendingTransaction(true);
      setSendingPhase('stand');

      const standResult = await blackjackClient.playerStand(gameId);
      setTransactionSignatures(prev => [...prev, standResult.signature]);
      setTransactionError(null);
      setIsSendingTransaction(false);
      setSendingPhase('none');

      if (standResult.isBust) {
        handleGameOver('player_bust', playerHand, dealerHand, 200);
        return;
      }

      setIsDealing(true);

      setMainButtonPhase('dealer_play');
      setIsSendingTransaction(true);
      setSendingPhase('dealer_play');
      const dealerResult = await blackjackClient.dealerPlay(gameId);
      setTransactionSignatures(prev => [...prev, dealerResult.signature]);
      setIsSendingTransaction(false);
      setSendingPhase('none');

      const finalDealerCards = dealerResult.dealerHand.map(c => ({ ...c, isHidden: false }));

      const revealedExisting = dealerHand.map((c, i) => {
        if (c.isHidden && i < finalDealerCards.length) {
          return { ...finalDealerCards[i], isHidden: false };
        }
        return c;
      });
      setDealerHand(revealedExisting);

      const animationDelay = standResult.isBust ? 0 : 800;
      for (let i = dealerHand.length; i < finalDealerCards.length; i++) {
        if (animationDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, animationDelay));
        }
        setDealerHand(prev => [...prev, { ...finalDealerCards[i], isHidden: false }]);
      }

      if (!standResult.isBust) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setMainButtonPhase('resolve');
      setIsSendingTransaction(true);
      setSendingPhase('resolve');
      const resolveResult = await blackjackClient.resolveGame(gameId);
      const resolveSignature = blackjackClient.getLastTransactionSignature();
      if (resolveSignature) setTransactionSignatures(prev => [...prev, resolveSignature]);
      setIsSendingTransaction(false);
      setSendingPhase('none');

      const gameStatus = blockchainResultToGameStatus(resolveResult.winner);
      handleGameOver(gameStatus, playerHand, finalDealerCards, 500);
      setIsDealing(false);
    } catch (error) {
      console.error('Error in stand flow:', error);
      setIsSendingTransaction(false);
      setIsDealing(false);
      setTransactionError("Transaction failed");
      setTransactionSignatures([]);
      setSendingPhase('none');
      hideAllCards();
      resetGameOnError();
    }
  };

  const handleGameOver = (
    result: GameStatus,
    finalPlayerHand: Card[],
    finalDealerHand: Card[],
    additionalAnimationDelay: number = 0
  ) => {
    setDealerHand(prev => prev.map((c, i) => {
      if (c.isHidden && i < finalDealerHand.length) {
        return { ...finalDealerHand[i], isHidden: false };
      }
      return c;
    }));

    setGameEnding(true);

    const animationDelay = additionalAnimationDelay > 0 ? additionalAnimationDelay : 0;

    setTimeout(() => {
      setStatus(result);
      setMainButtonPhase('hit');

    if (stats && connected && publicKey) {
      const updates: { wins?: number; losses?: number; draws?: number } = {};

      if (['blackjack', 'player_win', 'dealer_bust'].includes(result)) {
        updates.wins = 1;
      } else if (['dealer_win', 'player_bust'].includes(result)) {
        updates.losses = 1;
      } else if (result === 'push') {
        updates.draws = 1;
      }

      updateStats.mutate(updates);
    }
    }, animationDelay);
  };

  const hideAllCards = () => {
    setPlayerHand(prev => prev.map(card => ({ ...card, isHidden: true })));
    setDealerHand(prev => prev.map(card => ({ ...card, isHidden: true })));
  };

  const resetGameOnError = () => {
    const newGameId = Date.now();
    setGameId(newGameId);

    const playerPlaceholders = placeholderHand(2);
    const dealerPlaceholders = placeholderHand(2);
    setPlayerHand(playerPlaceholders);
    setDealerHand(dealerPlaceholders);
    setDeck([]);
    setStatus('waiting_to_deal');
    setIsDealing(false);
    setIsSendingTransaction(false);
    setGameEnding(false);
    setMainButtonPhase('hit');
    setSendingPhase('none');
  };

  const visiblePlayerCards = playerHand.filter(c => !c.isHidden);
  const visibleDealerCards = dealerHand.filter(c => !c.isHidden);
  const playerScore = visiblePlayerCards.length > 0 ? calculateScore(visiblePlayerCards) : "?";
  const dealerScore = visibleDealerCards.length > 0 ? calculateScore(visibleDealerCards) : "?";

  const formatWalletAddress = (address: string) => {
    if (address.length <= 8) return address;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const prefixLength = isMobile ? 2 : 4;
    const suffixLength = isMobile ? 2 : 4;
    return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
  };

  const copyWalletAddress = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddresses(prev => new Set(prev).add(address));
      setTimeout(() => {
        setCopiedAddresses(prev => {
          const newSet = new Set(prev);
          newSet.delete(address);
          return newSet;
        });
      }, 2000);
    } catch (err) {
    }
  }, []);

  const highlightPlayerCards = ['player_win', 'blackjack', 'dealer_bust'].includes(status);
  const highlightDealerCards = ['dealer_win', 'player_bust'].includes(status);
  const gameEnded = ['player_win', 'dealer_win', 'blackjack', 'player_bust', 'dealer_bust', 'push'].includes(status);

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col overflow-hidden relative selection:bg-none">
      {/* ASCII Clouds Background */}
      <AsciiClouds
        className="fixed inset-0 -z-10"
        showControls={false}
        initialSettings={asciiCloudsSettings}
      />

      <div className="flex-shrink-0 p-4 md:p-8 relative">
        {/* Mobile Layout */}
        <div className="flex flex-col items-center gap-4 md:hidden">
          <header className="z-10">
            <div className="flex flex-col items-center">
              <div
                ref={dropdownRef}
                className={cn(
                  "bg-black/20 rounded-md backdrop-blur-sm border border-white/10 transition-all ease-in-out overflow-hidden",
                  isGameDropdownOpen ? "duration-700 max-h-96" : "duration-300 max-h-11"
                )}
              >
                <div
                  className="flex items-center justify-between px-4 py-1 rounded-t-md w-full cursor-pointer"
                  onClick={() => {
                    if (isGameDropdownOpen && dropdownType !== 'game') {
                      setIsGameDropdownOpen(false);
                      setTimeout(() => {
                        setDropdownType('game');
                        setIsGameDropdownOpen(true);
                      }, 250);
                    } else {
                      const shouldOpen = !isGameDropdownOpen || dropdownType !== 'game';
                      setDropdownType('game');
                      setIsGameDropdownOpen(shouldOpen);
                    }
                    setIsDropdownButtonHovered(true);
                    setIsXButtonHovered(false);
                    setLastClickedButton('dropdown');
                    setTimeout(() => setIsDropdownButtonHovered(false), 200);
                  }}
                >
                  <h1 className="text-2xl font-black tracking-tighter text-white flex-shrink-0">
                    Nebula<span className="text-purple-800">.Blackjack</span>
                  </h1>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGameDropdownOpen && dropdownType !== 'game') {
                          setIsGameDropdownOpen(false);
                          setTimeout(() => {
                            setDropdownType('game');
                            setIsGameDropdownOpen(true);
                          }, 250);
                        } else {
                          const shouldOpen = !isGameDropdownOpen || dropdownType !== 'game';
                          setDropdownType('game');
                          setIsGameDropdownOpen(shouldOpen);
                        }
                        setIsXButtonHovered(false);
                        setLastClickedButton('dropdown');
                      }}
                      onMouseEnter={() => {
                        if (lastClickedButton !== 'x') {
                          setIsDropdownButtonHovered(true);
                        }
                      }}
                      onMouseLeave={() => {
                        setTimeout(() => {
                          setIsDropdownButtonHovered(false);
                          setLastClickedButton(null);
                        }, 200);
                      }}
                      onTouchStart={() => {
                        if (lastClickedButton !== 'x') {
                          setIsDropdownButtonHovered(true);
                        }
                      }}
                      onTouchEnd={() => {
                        setTimeout(() => {
                          setIsDropdownButtonHovered(false);
                          setLastClickedButton(null);
                        }, 200);
                      }}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isDropdownButtonHovered && "bg-white/10"
                      )}
                    >
                      <ChevronDown className={cn("w-5 h-5 text-white/70 transition-transform duration-200 ease-in-out", isGameDropdownOpen && dropdownType === 'game' && "rotate-180")} />
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsLeaderboardButtonPressed(true);
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        setTimeout(() => setIsLeaderboardButtonPressed(false), 200);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        setTimeout(() => setIsLeaderboardButtonPressed(false), 200);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLeaderboardModalOpen(true);
                      }}
                      className={`h-7 w-7 rounded flex items-center justify-center hover:bg-white/10 transition-all duration-300 ease-out ml-1 ${
                        isLeaderboardButtonPressed ? 'scale-110' : 'scale-100'
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-white/70" />
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsHelpButtonPressed(true);
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        setTimeout(() => setIsHelpButtonPressed(false), 200);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        setTimeout(() => setIsHelpButtonPressed(false), 200);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSecurityModalOpen(true);
                      }}
                      className={`h-7 w-7 rounded flex items-center justify-center hover:bg-white/10 transition-all duration-300 ease-out ml-1 ${
                        isHelpButtonPressed ? 'scale-110' : 'scale-100'
                      }`}
                    >
                      <span className="text-xl text-white/70">?</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGameDropdownOpen && dropdownType !== 'twitter') {
                          setIsGameDropdownOpen(false);
                          setTimeout(() => {
                            setDropdownType('twitter');
                            setIsGameDropdownOpen(true);
                          }, 250);
                        } else {
                          const shouldOpen = !isGameDropdownOpen || dropdownType !== 'twitter';
                          setDropdownType('twitter');
                          setIsGameDropdownOpen(shouldOpen);
                        }
                        setIsDropdownButtonHovered(false);
                        setLastClickedButton('x');
                      }}
                      onMouseEnter={() => {
                        if (lastClickedButton !== 'dropdown') {
                          setIsXButtonHovered(true);
                        }
                      }}
                      onMouseLeave={() => {
                        setTimeout(() => {
                          setIsXButtonHovered(false);
                          setLastClickedButton(null);
                        }, 200);
                      }}
                      onTouchStart={() => {
                        if (lastClickedButton !== 'dropdown') {
                          setIsXButtonHovered(true);
                        }
                      }}
                      onTouchEnd={() => {
                        setTimeout(() => {
                          setIsXButtonHovered(false);
                          setLastClickedButton(null);
                        }, 200);
                      }}
                      className={cn(
                        "h-7 w-7 rounded flex items-center justify-center transition-all duration-300 ease-out ml-1",
                        isXButtonHovered && "bg-white/10"
                      )}
                    >
                      <XIcon className="w-4 h-4 text-white/70" />
                    </button>
                  </div>
                </div>

                <div className={cn(
                  "transition-opacity duration-500 ease-in-out",
                  isGameDropdownOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}>
                  {dropdownType === 'game' ? (
                    <>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation('/coinflip');
                        }}
                        className="bg-purple-800/10 px-2 py-2 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors pointer-events-auto"
                      >
                        <div className="mx-1.5 text-xl font-black tracking-tighter text-white">
                          Nebula<span className="text-purple-800">.Coinflip</span>
                        </div>
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open('https://arcanehands.xyz', '_blank');
                        }}
                        className="bg-purple-800/10 px-2 py-2 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors pointer-events-auto"
                      >
                        <div className="mx-1.5 text-xl font-black tracking-tighter text-white">
                          Arcane Hands
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open('https://x.com/rodionadov', '_blank');
                        }}
                        className="px-4 py-3 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors"
                      >
                        <div className="text-center text-sm font-medium text-white">
                          @adov
                        </div>
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open('https://x.com/deundef1ned', '_blank');
                        }}
                        className="px-4 py-3 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors"
                      >
                        <div className="text-center text-sm font-medium text-white">
                          @deundef1ned
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>
          <WalletInfo />
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block">
          <header className="absolute top-8 left-8 z-10">
            <div className="bg-black/20 rounded-md backdrop-blur-sm border border-white/10 px-4 py-1 mb-4 shadow-lg shadow-black/70">
              <h1 className="text-3xl font-black tracking-tighter text-white">
                Nebula<span className="text-purple-800">.Blackjack</span>
              </h1>
            </div>
          </header>

          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 flex items-start gap-4">
            <div
              ref={dropdownRef}
              className={cn(
                "bg-black/20 backdrop-blur-sm border border-white/10 flex flex-col items-center overflow-hidden shadow-lg shadow-black/70 rounded-full",
                isGameDropdownOpen ? "w-60 h-36" : "w-10 h-10",
                hasInitialized && (isGameDropdownOpen ? "animate-unified-dropdown-open" : "animate-unified-dropdown-close")
              )}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasInitialized) {
                    setHasInitialized(true);
                  }
                  setIsGameDropdownOpen(!isGameDropdownOpen);
                }}
                className={cn(
                  "h-10 flex items-center justify-center hover:bg-white/10 transition-all duration-300 relative z-10",
                  isGameDropdownOpen ? "w-full" : "w-10"
                )}
              >
                <ChevronDown className={cn("w-10 h-10 text-white/70 transition-transform duration-300 ease-in-out", isGameDropdownOpen && "rotate-180")} />
              </button>

              {isGameDropdownOpen && (
                <div
                  className="w-full animate-in fade-in duration-500"
                  style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation('/coinflip');
                    }}
                    className="px-4 py-3 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors"
                  >
                    <div className="text-center text-xl font-black tracking-tighter text-white">
                      Nebula<span className="text-purple-800">.Coinflip</span>
                    </div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open('https://arcanehands.xyz', '_blank');
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-purple-800/20 transition-colors"
                  >
                    <div className="text-center text-xl font-black tracking-tighter text-white">
                      Arcane Hands
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onMouseDown={() => setIsLeaderboardButtonPressed(true)}
              onMouseUp={() => {
                setTimeout(() => setIsLeaderboardButtonPressed(false), 200);
              }}
              onMouseLeave={() => {
                setTimeout(() => setIsLeaderboardButtonPressed(false), 200);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsLeaderboardModalOpen(true);
              }}
              className={`h-10 w-10 bg-black/20 backdrop-blur-sm border border-white/10 shadow-lg shadow-black/70 rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-700 ease-out relative z-10 ${
                isLeaderboardButtonPressed ? 'scale-110' : 'scale-100'
              }`}
            >
              <Trophy className="w-5 h-5 text-white/70" />
            </button>

            <button
              onMouseDown={() => setIsHelpButtonPressed(true)}
              onMouseUp={() => {
                setTimeout(() => setIsHelpButtonPressed(false), 200);
              }}
              onMouseLeave={() => {
                setTimeout(() => setIsHelpButtonPressed(false), 200);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsSecurityModalOpen(true);
              }}
              className={`h-10 w-10 bg-black/20 backdrop-blur-sm border border-white/10 shadow-lg shadow-black/70 rounded-full flex items-center justify-center hover:bg-white/10 transition-all duration-700 ease-out relative z-10 ${
                isHelpButtonPressed ? 'scale-110' : 'scale-100'
              }`}
            >
              <span className="text-xl text-white/70">?</span>
            </button>

            <div
              ref={twitterDropdownRef}
              className={cn(
                "bg-black/20 backdrop-blur-sm border border-white/10 flex flex-col items-center overflow-hidden shadow-lg shadow-black/70 rounded-full",
                isTwitterDropdownOpen ? "w-10 h-30" : "w-10 h-10",
                hasTwitterInitialized && (isTwitterDropdownOpen ? "animate-twitter-dropdown-open" : "animate-twitter-dropdown-close")
              )}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasTwitterInitialized) {
                    setHasTwitterInitialized(true);
                  }
                  setIsTwitterDropdownOpen(!isTwitterDropdownOpen);
                }}
                className={cn(
                  "h-10 flex-shrink-0 flex items-center justify-center hover:bg-white/10 transition-all duration-300 relative z-10",
                  isTwitterDropdownOpen ? "w-full" : "w-10"
                )}
              >
                <XIcon className="w-5 h-5 text-white/70" />
              </button>

              {isTwitterDropdownOpen && (
                <div
                  className="w-full animate-in fade-in duration-500"
                  style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open('https://x.com/rodionadov', '_blank');
                    }}
                    className="px-4 py-3 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors"
                  >
                    <div className="text-center text-sm font-medium text-white">
                      @adov
                    </div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open('https://x.com/deundef1ned', '_blank');
                    }}
                    className="px-4 py-3 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors"
                  >
                    <div className="text-center text-sm font-medium text-white">
                      @deundef1ned
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <WalletInfo />
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center relative max-w-5xl mx-auto w-full md:pt-12">

        <div className="w-full mb-8 md:mb-8 flex flex-col items-center relative">
          {dealerHand.length > 0 && (
            <div className="mb-6 md:mb-10 flex items-center gap-2">
              <div className="bg-black/20 text-white/90 px-3 py-1 rounded-md text-sm font-mono font-bold backdrop-blur-sm border border-white/90 shadow-lg shadow-black/70">
                {dealerScore}
              </div>
            </div>
          )}
          <div
            className="w-full flex justify-center items-start"
            style={(() => {
              if (!gameEnded) return {};
              const isMob = typeof window !== 'undefined' && window.innerWidth < 640;
              const cardsPerRow = isMob ? 3 : dealerHand.length;
              const rows = Math.ceil(dealerHand.length / cardsPerRow);
              if (rows <= 1) return {};
              const cardH = isMob ? 144 : 192;
              const rGap = isMob ? 10 : 14;
              return { minHeight: rows * cardH + (rows - 1) * rGap };
            })()}
          >
             <div className="relative flex justify-center">
              {dealerHand.map((card, i) => (
                <PlayingCard
                  key={`dealer-${gameId}-${i}`}
                  card={card}
                  index={i}
                  totalCards={dealerHand.length}
                  highlight={highlightDealerCards}
                  gameEnded={gameEnded}
                />
              ))}
             </div>
          </div>
        </div>

        <div className="h-16 flex items-center justify-center relative">
          <StatusBadge status={status} />
        </div>

        <div className="w-full flex flex-col items-center relative z-20">
          <div
            className="w-full flex justify-center items-start"
            style={(() => {
              if (!gameEnded) return {};
              const isMob = typeof window !== 'undefined' && window.innerWidth < 640;
              const cardsPerRow = isMob ? 3 : playerHand.length;
              const rows = Math.ceil(playerHand.length / cardsPerRow);
              if (rows <= 1) return {};
              const cardH = isMob ? 144 : 192;
              const rGap = isMob ? 10 : 14;
              return { minHeight: rows * cardH + (rows - 1) * rGap };
            })()}
          >
            <div className="relative flex justify-center">
              {playerHand.map((card, i) => (
                <PlayingCard
                  key={`player-${gameId}-${i}`}
                  card={card}
                  index={i}
                  totalCards={playerHand.length}
                  highlight={highlightPlayerCards}
                  gameEnded={gameEnded}
                />
              ))}
            </div>
          </div>
          {playerHand.length > 0 && (
            <div className="mt-6 flex items-center gap-2">
              <div className="bg-black/20 text-white/90 px-3 py-1 rounded-md text-sm font-mono font-bold backdrop-blur-sm border border-white/90 shadow-lg shadow-black/70">
                {playerScore}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <ScoreBoard stats={stats} />
        </div>

        <div className={`flex justify-center items-center mb-2 ${transactionSignatures.length > 0 ? 'mt-10' : 'mt-2'}`}>
          {transactionSignatures.length > 0 ? (
            <div className="max-w-lg mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
              <TransactionLink signatures={transactionSignatures} />
            </div>
          ) : transactionError ? (
            <div className="max-w-lg mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-1 select-none pointer-events-none">
                <span className="text-xs font-mono text-red-400">⚠</span>
                <span className="text-xs font-mono text-red-400">Transaction Failed</span>
              </div>
            </div>
          ) : (
            <div className="max-w-lg mx-auto w-full invisible">
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-white">Tx:</span>
                <span className="text-xs font-mono text-white/70">placeholder</span>
              </div>
            </div>
          )}
        </div>

        <div className="w-full pb-10 md:pb-10 z-30 relative transition-all duration-300">
          <GameControls
            status={status}
            onHit={handleHit}
            onStand={handleStand}
            onNewGame={startNewGame}
            onDealCards={dealCards}
            disabled={(status !== 'playing' && status !== 'waiting_to_deal') || isDealing || isStartingNewGame || gameEnding || isSendingTransaction || !connected || !publicKey || !blackjackClient}
            newGameDisabled={isStartingNewGame}
            isSendingTransaction={isSendingTransaction}
            mainButtonPhase={mainButtonPhase}
            sendingPhase={sendingPhase}
          />
        </div>

      </main>

      {/* Bottom Bar */}
      {/* <div className="w-full h-8 bg-black/20 backdrop-blur-sm flex items-center justify-center relative z-10">
        <span className="text-white/60 text-xs font-light tracking-wider">Nebula</span>
      </div> */}

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[100px] rounded-full" />
      </div>

      <Dialog open={isSecurityModalOpen} onOpenChange={setIsSecurityModalOpen}>
        <DialogContent className="bg-black/90 border-white/10 text-white max-w-2xl md:w-auto w-[calc(100vw-2rem)] rounded-xl top-4 [&>button]:h-6 [&>button]:w-6 [&>button]:p-0 [&>button]:bg-white/10 [&>button:hover]:bg-white/20 [&>button]:transition-colors [&>button]:duration-200 [&>button]:border [&>button]:rounded-full [&>button]:border-white/20 [&>button]:flex [&>button]:items-center [&>button]:justify-center translate-y-0 animate-in fade-in slide-in-from-top-4 duration-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">How It Works</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-white/80 space-y-4 leading-relaxed">
            <div>
              Physical blackjack naturally hides the dealer's hole card. Digital blackjack has a different problem:
              the card's value must be stored somewhere - whether that's on a game server, in a database, or in code.
              Trusting a server to "hide" it just means betting they won't peek.
            </div>
            <div>
              At game initialization, a 52-card deck is shuffled using Arcium's cryptographic randomness. The entire deck,
              including player cards and the dealer's hole card, remains encrypted throughout gameplay.
            </div>
            <div>
              Information disclosure follows game rules: players view their own cards and the dealer's face-up card.
              Game actions (hit, stand) are processed against encrypted hand values. The dealer's hole card and
              undealt cards remain encrypted until game resolution.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLeaderboardModalOpen} onOpenChange={setIsLeaderboardModalOpen}>
        <DialogContent className="bg-black/90 border-white/10 text-white w-[896px] max-md:w-[calc(100vw-2rem)] !max-w-none rounded-xl top-4 [&>button]:h-6 [&>button]:w-6 [&>button]:p-0 [&>button]:bg-white/10 [&>button:hover]:bg-white/20 [&>button]:transition-colors [&>button]:duration-200 [&>button]:border [&>button]:rounded-full [&>button]:border-white/20 [&>button]:flex [&>button]:items-center [&>button]:justify-center translate-y-0 animate-in fade-in slide-in-from-top-4 duration-700 max-h-[calc(100vh-3rem)]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">Leaderboard</DialogTitle>
          </DialogHeader>
          <div className="text-white/80 leading-relaxed mt-4 overflow-y-auto max-h-[calc(100vh-10rem)] w-full">
            {leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-1">
                <div className="grid grid-cols-5 gap-1 sm:gap-4 text-xs sm:text-sm font-mono font-bold text-white/90 border-b border-white/20 pb-2">
                  <div className="flex items-center">Rank</div>
                  <div className="flex items-center">Wallet</div>
                  <div className="flex items-center justify-center">Wins</div>
                  <div className="flex items-center justify-center">Draws</div>
                  <div className="flex items-center justify-center">Losses</div>
                </div>
                <div className="space-y-1">
                  {(() => {
                    const connectedWalletAddress = publicKey?.toString();

                    const connectedWalletRank = connectedWalletAddress
                      ? leaderboard.findIndex(entry => entry.wallet_address === connectedWalletAddress) + 1
                      : null;

                    let leaderboardData = leaderboard.slice(0, 100);

                    if (connectedWalletAddress) {
                      const connectedEntry = leaderboard.find(entry => entry.wallet_address === connectedWalletAddress);
                      if (connectedEntry) {
                        const isConnectedInTop100 = leaderboardData.some(entry => entry.wallet_address === connectedWalletAddress);
                        if (isConnectedInTop100) {
                          leaderboardData = leaderboardData.filter(entry => entry.wallet_address !== connectedWalletAddress);
                          leaderboardData = [connectedEntry, ...leaderboardData];
                        } else {
                          leaderboardData = [connectedEntry, ...leaderboardData];
                        }
                      }
                    }

                    return leaderboardData.map((entry, index) => {
                      const isConnectedWallet = connectedWalletAddress && entry.wallet_address === connectedWalletAddress;
                      const actualRank = isConnectedWallet && connectedWalletRank
                        ? connectedWalletRank
                        : leaderboard.findIndex(e => e.wallet_address === entry.wallet_address) + 1;

                      return (
                        <div key={entry.wallet_address} className={cn(
                          "grid grid-cols-5 gap-1 sm:gap-4 text-xs sm:text-sm font-mono text-white/80 hover:bg-white/5 border border-white/10 rounded px-2 py-1 transition-colors",
                          isConnectedWallet && "bg-purple-500/20 border-purple-500/50 ring-1 ring-purple-500/30"
                        )}>
                          <div className="flex items-center">
                            {isConnectedWallet ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs sm:text-sm font-mono text-purple-400 font-bold">
                                  {actualRank}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs sm:text-sm font-mono text-white/80">
                                {actualRank}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <button
                              onClick={() => copyWalletAddress(entry.wallet_address)}
                              className={cn(
                                "w-auto text-left transition-colors hover:text-purple-300 flex items-center justify-start",
                                isConnectedWallet && "text-purple-300 font-semibold"
                              )}
                              title="Copy wallet address"
                            >
                              <span className="flex-1 min-w-0 overflow-hidden text-ellipsis">{formatWalletAddress(entry.wallet_address)}</span>
                              <div className="w-3 h-3 ml-2 flex-shrink-0 relative">
                                <Copy className={cn(
                                  "w-3 h-3 text-white/60 absolute inset-0 transition-opacity duration-200",
                                  copiedAddresses.has(entry.wallet_address) ? "opacity-0" : "opacity-100"
                                )} />
                                <Check className={cn(
                                  "w-3 h-3 text-green-400 absolute inset-0 transition-opacity duration-200",
                                  copiedAddresses.has(entry.wallet_address) ? "opacity-100" : "opacity-0"
                                )} />
                              </div>
                            </button>
                          </div>
                          <div className="flex items-center justify-center text-green-700 font-bold">
                            {entry.wins}
                          </div>
                          <div className="flex items-center justify-center text-gray-500 font-bold">
                            {entry.draws}
                          </div>
                          <div className="flex items-center justify-center text-red-700 font-bold">
                            {entry.losses}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center text-white/60 py-8">
                No one's here yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
