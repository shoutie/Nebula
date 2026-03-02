import { useState, useEffect } from "react";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Check, X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const FaucetIcon = ({ className }: { className?: string }) => (
  <img
    src="/faucet.png"
    alt="Faucet"
    className={className}
  />
);

export function WalletInfo() {
  const { publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const [isRequestingFaucet, setIsRequestingFaucet] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [balance, setBalance] = useState<number | null>(null);
  const [isFaucetButtonHovered, setIsFaucetButtonHovered] = useState(false);
  const [isDisconnectButtonHovered, setIsDisconnectButtonHovered] = useState(false);
  const isWalletConnected = !!publicKey;

  const fetchBalance = async () => {
    if (!publicKey || !connection) return;

    try {
      const balanceLamports = await connection.getBalance(publicKey);
      const balanceSOL = balanceLamports / 1_000_000_000;
      setBalance(balanceSOL);
    } catch (error) {
      setBalance(null);
    }
  };

  useEffect(() => {
    if (publicKey && connection) {
      fetchBalance();
    } else {
      setBalance(null);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (!publicKey || !connection) return;

    const interval = setInterval(() => {
      fetchBalance();
    }, 10000);

    return () => clearInterval(interval);
  }, [publicKey, connection]);

  const requestFaucet = async () => {
    if (!publicKey || !connection || isRequestingFaucet) return;

    setIsRequestingFaucet(true);
    setFaucetStatus('idle');

    try {
      const signature = await connection.requestAirdrop(publicKey, 2_000_000_000);

      await connection.confirmTransaction(signature, 'confirmed');

      setFaucetStatus('success');
      await fetchBalance();
      setTimeout(() => setFaucetStatus('idle'), 3000);
    } catch (error) {
      setFaucetStatus('error');
      setTimeout(() => setFaucetStatus('idle'), 3000);
    } finally {
      setIsRequestingFaucet(false);
    }
  };

  if (!isWalletConnected) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="md:absolute md:top-8 md:right-8 md:z-20 flex items-center gap-3 bg-black/20 px-4 py-1 rounded-md backdrop-blur-sm border border-white/10 shadow-lg shadow-black/70 z-10"
    >
      <Wallet className="w-4 h-4 text-white/90" />
      <span className="mt-0.5 text-sm font-mono text-white/90">
        {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
      </span>
      {balance !== null && (
        <span className="mt-0.5 text-sm font-mono text-white/50">
          {balance.toFixed(2)} SOL
        </span>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={requestFaucet}
        disabled={isRequestingFaucet}
        onMouseEnter={() => setIsFaucetButtonHovered(true)}
        onMouseLeave={() => setTimeout(() => setIsFaucetButtonHovered(false), 200)}
        onTouchStart={() => setIsFaucetButtonHovered(true)}
        onTouchEnd={() => setTimeout(() => setIsFaucetButtonHovered(false), 200)}
        className={cn("h-6 w-6 p-0 transition-colors", isFaucetButtonHovered && "bg-white/10")}
        title="Request SOL"
      >
        <motion.div
          key={isRequestingFaucet ? 'loading' : faucetStatus}
          initial={{ scale: 1, opacity: 0, rotate: 0 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 1, opacity: 0, rotate: 0 }}
          transition={{
            duration: 0.3
          }}
          className="flex items-center justify-center"
        >
          {isRequestingFaucet ? (
            <Loader2 className="w-4 h-4 text-white/70 animate-spin" />
          ) : faucetStatus === 'success' ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : faucetStatus === 'error' ? (
            <X className="w-4 h-4 text-red-500" />
          ) : (
            <FaucetIcon className="w-4 h-4 text-white/70" />
          )}
        </motion.div>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={disconnect}
        onMouseEnter={() => setIsDisconnectButtonHovered(true)}
        onMouseLeave={() => setTimeout(() => setIsDisconnectButtonHovered(false), 200)}
        onTouchStart={() => setIsDisconnectButtonHovered(true)}
        onTouchEnd={() => setTimeout(() => setIsDisconnectButtonHovered(false), 200)}
        className={cn("h-6 w-6 p-0 transition-colors", isDisconnectButtonHovered && "bg-white/10")}
      >
        <LogOut className="w-3 h-3 text-white/70" />
      </Button>
    </motion.div>
  );
}