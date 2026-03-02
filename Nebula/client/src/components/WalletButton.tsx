import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut } from 'lucide-react';

export function WalletButton() {
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-md border border-white/20">
          <Wallet className="w-4 h-4 text-white/90" />
          <span className="text-sm font-mono text-white/90">
            {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          className="bg-black/20 border-white/20 text-white/90 hover:bg-black/30"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setVisible(true)}
      className="bg-purple-500/20 hover:bg-purple-800/30 duration-100 border border-purple-700/50 text-white text-lg px-8 py-6 backdrop-blur-sm shadow-lg shadow-black/70 font-medium active:scale-95"
    >
      Select Wallet
    </Button>
  );
}