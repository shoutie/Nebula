import { useState, useEffect, useRef, useCallback } from "react";
import { RetroCoin } from "@/components/RetroCoin";
import { DustParticles } from "@/components/ParticleEffect";
import { CoinflipScoreBoard } from "@/components/CoinflipScoreBoard";
import AsciiClouds from "@/components/AsciiClouds";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trophy, Copy, Check } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WalletInfo } from "@/components/WalletInfo";
import { WalletButton } from "@/components/WalletButton";
import { useWallet } from '@solana/wallet-adapter-react';
import { useCoinflipStats, useUpdateCoinflipStats } from "@/hooks/use-coinflip-stats";
import { useCoinflipLeaderboard } from "@/hooks/use-coinflip-leaderboard";
import { CoinflipClient } from "@/lib/coinflip-client";
import { TransactionLink } from "@/components/TransactionLink";
import { useConnection } from '@solana/wallet-adapter-react';

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

type GameState = "idle" | "flipping" | "result";

export default function Coinflip() {
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

  const [gameState, setGameState] = useState<GameState>("idle");
  const [coinY, setCoinY] = useState(0);
  const [coinX, setCoinX] = useState(0);
  const [coinRotationY, setCoinRotationY] = useState(0);
  const [lastResult, setLastResult] = useState<"heads" | "tails" | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<"heads" | "tails" | null>(null);
  const [landTrigger, setLandTrigger] = useState(0);
  const [isGameDropdownOpen, setIsGameDropdownOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  const [isHelpButtonPressed, setIsHelpButtonPressed] = useState(false);
  const [isLeaderboardButtonPressed, setIsLeaderboardButtonPressed] = useState(false);
  const [hasTwitterInitialized, setHasTwitterInitialized] = useState(false);
  const [isTwitterDropdownOpen, setIsTwitterDropdownOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isDropdownButtonHovered, setIsDropdownButtonHovered] = useState(false);
  const [isXButtonHovered, setIsXButtonHovered] = useState(false);
  const [dropdownType, setDropdownType] = useState<'game' | 'twitter'>('game');
  const [lastClickedButton, setLastClickedButton] = useState<'dropdown' | 'x' | null>(null);
  const [hasInitialAnimationPlayed, setHasInitialAnimationPlayed] = useState(false);
  const [isInitialAnimationPlaying, setIsInitialAnimationPlaying] = useState(false);
  const [copiedAddresses, setCopiedAddresses] = useState<Set<string>>(new Set());
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [transactionSignatures, setTransactionSignatures] = useState<string[]>([]);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [isResultPaused, setIsResultPaused] = useState(false);
  const [isCoinHovered, setIsCoinHovered] = useState(false);

  const [, setLocation] = useLocation();

  const animationRef = useRef<number>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const twitterDropdownRef = useRef<HTMLDivElement>(null);

  const { connected, publicKey, wallet } = useWallet();
  const { connection } = useConnection();

  const [coinflipClient, setCoinflipClient] = useState<CoinflipClient | null>(null);

  const { data: coinflipStats, isLoading: isStatsLoading } = useCoinflipStats(publicKey?.toString());
  const updateCoinflipStats = useUpdateCoinflipStats(publicKey?.toString());
  const { data: coinflipLeaderboard, isLoading: isLeaderboardLoading, refetch: refetchLeaderboard } = useCoinflipLeaderboard();

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

  useEffect(() => {
    if (isLeaderboardModalOpen) {
      refetchLeaderboard();
    }
  }, [isLeaderboardModalOpen, refetchLeaderboard]);

  useEffect(() => {
    if (connected && publicKey && wallet && connection) {
      try {
        const client = new CoinflipClient(connection, wallet);
        setCoinflipClient(client);
      } catch (error) {
        setCoinflipClient(null);
      }
    } else {
      setCoinflipClient(null);
    }
  }, [connected, publicKey, wallet, connection]);

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
    }
  }, [connected]);

  const GRAVITY = 0.5;
  const JUMP_FORCE = -18;
  const FLOOR_Y = 0;

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if ((gameState === "idle" || selectedChoice !== null) && !isResultPaused && !isCoinHovered && !isInitialAnimationPlaying) {
      const idleRotate = () => {
        setCoinRotationY(prev => (prev + 0.3) % 360);
        animationRef.current = requestAnimationFrame(idleRotate);
      };

      animationRef.current = requestAnimationFrame(idleRotate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [gameState, selectedChoice, isResultPaused, isCoinHovered]);

  useEffect(() => {
    if (!hasInitialAnimationPlayed) {
      setHasInitialAnimationPlayed(true);
      setIsInitialAnimationPlaying(true);
      setCoinY(FLOOR_Y);
      setCoinRotationY(0);

      setTimeout(() => {
        startInitialBounceAnimation("heads");
      }, 300);
    }
  }, [hasInitialAnimationPlayed]);

  const handleFlip = async (choice: "heads" | "tails") => {
    if (gameState === "flipping" || !connected || !publicKey || !coinflipClient) return;

    setSelectedChoice(choice);
    setIsCoinHovered(false);
    setGameState("flipping");
    setIsSendingTransaction(true);
    setTransactionError(null);
    setTransactionSignatures([]);

    try {
      const flipResult = choice === "heads"
        ? await coinflipClient.flipHeads()
        : await coinflipClient.flipTails();

      setTransactionSignatures(prev => [...prev, flipResult.signature]);
      setIsSendingTransaction(false);

      const isWin = flipResult.won;
      const result: "heads" | "tails" = isWin ? choice : (choice === "heads" ? "tails" : "heads");

      startFlipAnimation(result, isWin);
    } catch (err) {
      setIsSendingTransaction(false);
      setTransactionError(`Transaction failed: ${err instanceof Error ? err.message : String(err)}`);
      setSelectedChoice(null);
      setGameState("idle");
    }
  };

  const startFlipAnimation = (finalResult: "heads" | "tails", isWin: boolean) => {

    let velocity = JUMP_FORCE;
    let y = coinY;
    let x = coinX;
    const startTime = Date.now();

    let currentRotation = coinRotationY;
    let hasStartedSettling = false;
    let settlingStartTime = 0;
    let settlingStartRotation = 0;
    let bounceCount = 0;


    const rotationsCount = 2 + Math.floor(Math.random() * 2);
    const rotationSpeed = 300 + Math.random() * 150;

    const finalRotationAngle = finalResult === "tails" ? 195 : 15;
    const rotationDiff = finalRotationAngle - currentRotation;
    const normalizedDiff = ((rotationDiff % 360) + 360) % 360;
    const shortestDiff = normalizedDiff > 180 ? normalizedDiff - 360 : normalizedDiff;
    const targetRotation = currentRotation + (rotationsCount * 360) + shortestDiff;

    const wobbleSpeed = 0.15 + Math.random() * 0.1;
    const wobbleAmplitude = 5 + Math.random() * 5;

    const animate = () => {
      const now = Date.now();

      velocity += GRAVITY;
      y += velocity;

      if (y >= FLOOR_Y) {
        y = FLOOR_Y;

        if (Math.abs(velocity) > 4) {
           velocity = -velocity * 0.5;
           bounceCount++;
        } else {
           if (!hasStartedSettling) {
             hasStartedSettling = true;
             settlingStartTime = now;
             
             settlingStartRotation = ((currentRotation % 360) + 360) % 360;
           }

           const settlingDuration = 300;
           const settlingElapsed = now - settlingStartTime;
           if (settlingElapsed >= settlingDuration) {
             finishAnimation(finalResult, isWin);
             return;
           }
        }
      }
      const elapsed = now - startTime;
      
      if (!hasStartedSettling) {
        const progress = Math.min(1, elapsed / 3000);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        currentRotation = coinRotationY + (targetRotation - coinRotationY) * easedProgress;
        
        let wobbleX = Math.sin(elapsed * wobbleSpeed * 0.01) * wobbleAmplitude;

        const finalX = x + wobbleX;
        const discreteWobbleX = Math.round(finalX / 2) * 2;

        setCoinRotationY(currentRotation);
        setCoinX(discreteWobbleX);
      } else {
        const finalRotationAngle = finalResult === "tails" ? 195 : 15;

        const settlingDuration = 300;
        const settlingElapsed = now - settlingStartTime;
        const settlingProgress = Math.min(1, settlingElapsed / settlingDuration);

        if (settlingProgress < 1) {
          let diff = finalRotationAngle - settlingStartRotation;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          
          const easedProgress = 1 - Math.pow(1 - settlingProgress, 3);
          const interpolatedRotation = settlingStartRotation + diff * easedProgress;
          setCoinRotationY(interpolatedRotation);
        } else {
          setCoinRotationY(finalRotationAngle);
        }
      }

      setCoinY(y);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const startInitialBounceAnimation = (finalResult: "heads" | "tails") => {
    let velocity = JUMP_FORCE * 0.5;
    let y = FLOOR_Y;
    const startTime = Date.now();

    const startRotation = 0;
    const targetRotation = startRotation + 360;

    const wobbleSpeed = 0.08 + Math.random() * 0.06;
    const wobbleAmplitude = 3 + Math.random() * 3;

    const animate = () => {
      velocity += GRAVITY;
      y += velocity;

      if (y >= FLOOR_Y) {
        y = FLOOR_Y;

        if (Math.abs(velocity) > 3) {
          velocity = -velocity * 0.4;
        } else {
          velocity = 0;
          setCoinRotationY(0);
          setCoinY(FLOOR_Y);

          setLandTrigger(prev => prev + 1);

          setIsInitialAnimationPlaying(false);

          return;
        }
      }

      const now = Date.now();
      const elapsed = now - startTime;

      if (y < FLOOR_Y - 5) {
        const rotationProgress = Math.min(1, elapsed / 1200);
        const easedProgress = 1 - Math.pow(1 - rotationProgress, 2);
        const currentRotation = startRotation + (targetRotation - startRotation) * easedProgress;

        let wobbleX = Math.sin(elapsed * wobbleSpeed * 0.01) * wobbleAmplitude;

        const discreteWobbleX = Math.round(wobbleX / 2) * 2;

        setCoinRotationY(currentRotation);
        setCoinX(discreteWobbleX);
      } else if (velocity > 0) {
        setCoinRotationY(0);
      }

      setCoinY(y);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const finishAnimation = (result: "heads" | "tails", isWin: boolean) => {
    setCoinY(FLOOR_Y);
    setLastResult(result);
    setGameState("result");
    setLandTrigger(prev => prev + 1);

    setIsResultPaused(true);

    if (connected && publicKey) {
      const updates: { wins?: number; losses?: number } = {};

      if (isWin) {
        updates.wins = 1;
      } else {
        updates.losses = 1;
      }

      updateCoinflipStats.mutate(updates);
    }

    setTimeout(() => {
      setIsResultPaused(false);
      setIsCoinHovered(false);
      setGameState("idle");
      setSelectedChoice(null);
      setIsSendingTransaction(false);
    }, 2000);
  };

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

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col overflow-hidden relative selection:bg-none">
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
                    Nebula<span className="text-purple-800">.Coinflip</span>
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
                          setLocation('/');
                        }}
                        className="bg-purple-800/10 px-2 py-2 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors pointer-events-auto"
                      >
                        <div className="mx-1.5 text-xl font-black tracking-tighter text-white">
                          Nebula<span className="text-purple-800">.Blackjack</span>
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
                Nebula<span className="text-purple-800">.Coinflip</span>
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
                      setLocation('/');
                    }}
                    className="px-4 py-3 border-t border-white/10 cursor-pointer hover:bg-purple-800/20 transition-colors"
                  >
                    <div className="text-center text-xl font-black tracking-tighter text-white">
                      Nebula<span className="text-purple-800">.Blackjack</span>
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

      <main className="flex-1 flex flex-col items-center justify-center relative max-w-5xl mx-auto w-full pt-56 md:pt-48">


        <div className="relative mb-12">
          <div
            style={{
              transform: `translate3d(${coinX}px, ${coinY}px, 0px)`
            }}
          >
            <RetroCoin
              rotationY={coinRotationY}
              size={160}
              gameState={gameState}
              onRotationChange={setCoinRotationY}
              onHoverChange={setIsCoinHovered}
              isInitialAnimationPlaying={isInitialAnimationPlaying}
            />
          </div>
        </div>

        <div className="flex justify-center">
          <CoinflipScoreBoard stats={coinflipStats} />
        </div>

        <div className={`flex justify-center items-center mb-3 ${transactionSignatures.length > 0 ? 'mt-10' : 'mt-2'}`}>
          {transactionSignatures.length > 0 ? (
            <div className="max-w-lg mx-auto w-full">
              <TransactionLink signatures={transactionSignatures} />
            </div>
          ) : transactionError ? (
            <div className="max-w-lg mx-auto w-full">
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

        <div className="flex flex-wrap justify-center gap-4 z-30">
          {!connected ? (
            <motion.div
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <WalletButton />
            </motion.div>
          ) : (
            <motion.div
              className="flex"
            >
              <motion.div
                animate={{
                  width: selectedChoice === "heads" && gameState !== "result" ? "100%" : selectedChoice === "tails" && gameState !== "result" ? "0%" : "auto",
                  opacity: selectedChoice === null || selectedChoice === "heads" || gameState === "result" ? 1 : 0,
                  marginRight: selectedChoice === null || gameState === "result" ? 16 : 0
                }}
                transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                whileHover={selectedChoice === null ? { scale: 1 } : {}}
                whileTap={selectedChoice === null ? { scale: 0.97 } : {}}
              >
                <Button
                  onClick={() => handleFlip("heads")}
                  disabled={!connected || !publicKey || selectedChoice !== null}
                  className={cn(
                    "text-white text-lg px-8 py-6 transition-colors duration-100 backdrop-blur-sm shadow-lg shadow-black/70 bg-green-500/20 hover:bg-green-800/30 border border-green-500/50 flex items-center justify-center w-full disabled:text-white disabled:opacity-100",
                    selectedChoice === "heads" ? "ring-2 ring-green-500" : ""
                  )}
                >
                  <img
                    src="/solana.png"
                    alt="Solana"
                    className="w-7 h-7 object-contain scale-150"
                    style={{ transition: 'none' }}
                  />
                </Button>
              </motion.div>

              <motion.div
                animate={{
                  width: selectedChoice === "tails" && gameState !== "result" ? "100%" : selectedChoice === "heads" && gameState !== "result" ? "0%" : "auto",
                  opacity: selectedChoice === null || selectedChoice === "tails" || gameState === "result" ? 1 : 0
                }}
                transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                whileHover={selectedChoice === null ? { scale: 1 } : {}}
                whileTap={selectedChoice === null ? { scale: 0.97 } : {}}
              >
                <Button
                  onClick={() => handleFlip("tails")}
                  disabled={!connected || !publicKey || selectedChoice !== null}
                  variant="secondary"
                  className={cn(
                    "text-white text-lg px-8 py-6 transition-colors duration-100 backdrop-blur-sm shadow-lg shadow-black/70 bg-purple-500/20 hover:bg-purple-800/30 border border-purple-600/50 flex items-center justify-center w-full disabled:text-white disabled:opacity-100",
                    selectedChoice === "tails" ? "ring-2 ring-purple-500" : ""
                  )}
                >
                  <img
                    src="/nebula.png"
                    alt="Nebula"
                    className="w-7 h-7 object-contain scale-150"
                    style={{ transition: 'none' }}
                  />
                </Button>
              </motion.div>
            </motion.div>
          )}
        </div>

      </main>

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
              Flip a coin online and you have to trust someone.
              Trust the server not to rig the flip, or trust yourself not to inspect the code and game the system.
              There's no way to prove it's actually random.
            </div>
            <div>
              The coinflip follows this flow:
              <br />
              1. Player commitment: The player's choice (heads/tails) is encrypted and submitted to the network;
              <br />
              2. Random generation: Arcium nodes work together to generate a random boolean outcome;
              <br />
              3. Encrypted comparison: The system compares the encrypted choice against the encrypted random result;
              <br />
              4. Result disclosure: Only the win/loss outcome is revealed.
              <br />
            </div>
            <div>
              The comparison occurs on encrypted values throughout the computation.
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
            {coinflipLeaderboard && coinflipLeaderboard.length > 0 ? (
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-1 sm:gap-4 text-xs sm:text-sm font-mono font-bold text-white/90 border-b border-white/20 pb-2">
                  <div className="flex items-center">Rank</div>
                  <div className="flex items-center">Wallet</div>
                  <div className="flex items-center justify-center">Wins</div>
                  <div className="flex items-center justify-center">Losses</div>
                </div>
                <div className="space-y-1">
                  {(() => {
                    const connectedWalletAddress = publicKey?.toString();

                    const connectedWalletRank = connectedWalletAddress
                      ? coinflipLeaderboard.findIndex(entry => entry.wallet_address === connectedWalletAddress) + 1
                      : null;

                    let leaderboardData = coinflipLeaderboard.slice(0, 100);

                    if (connectedWalletAddress) {
                      const connectedEntry = coinflipLeaderboard.find(entry => entry.wallet_address === connectedWalletAddress);
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
                        : coinflipLeaderboard.findIndex(e => e.wallet_address === entry.wallet_address) + 1;

                      return (
                        <div key={entry.wallet_address} className={cn(
                          "grid grid-cols-4 gap-1 sm:gap-4 text-xs sm:text-sm font-mono text-white/80 hover:bg-white/5 border border-white/10 rounded px-2 py-1 transition-colors",
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