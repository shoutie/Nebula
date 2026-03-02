import { ExternalLink } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

interface TransactionLinkProps {
  signature?: string;
  signatures?: string[];
}

export function TransactionLink({ signature, signatures }: TransactionLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const lastMainSignatureRef = useRef<string | null>(null);

  const allSignatures = signatures || (signature ? [signature] : []);
  const mainSignature = allSignatures[allSignatures.length - 1];
  const hasHiddenItems = allSignatures.length > 1;

  if (!mainSignature) return null;

  useEffect(() => {
    const prev = lastMainSignatureRef.current;
    if (prev && prev !== mainSignature && !isOpen) {
      setIsPulsing(true);
      const timeout = setTimeout(() => setIsPulsing(false), 200);
      return () => clearTimeout(timeout);
    }
    lastMainSignatureRef.current = mainSignature;
  }, [mainSignature, isOpen]);

  const open = useCallback(() => {
    if (!hasInteracted) setHasInteracted(true);
    setIsOpen(true);
  }, [hasInteracted]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasInteracted) setHasInteracted(true);
  }, [hasInteracted]);

  const handleItemClick = useCallback((e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    if (!hasInteracted) setHasInteracted(true);

    if (typeof window !== 'undefined') {
      const isTouchDevice =
        window.matchMedia?.('(pointer: coarse)').matches ||
        window.innerWidth < 768;

      if (isTouchDevice && hasHiddenItems && !isOpen) {
        setIsOpen(true);
        return;
      }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [hasInteracted, hasHiddenItems, isOpen]);

  return (
    <div className="relative">
      <div
        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mt-2 border border-white/10 bg-black/20 backdrop-blur-sm shadow-lg shadow-black/70 z-30 rounded-md overflow-hidden"
        style={{
          transform: `translateX(-50%) scale(${isOpen || isPulsing ? 1.1 : 1})`,
          transition: ' transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onMouseEnter={open}
        onMouseLeave={close}
        onClick={handleContainerClick}
      >
        <div className="p-0 flex flex-col-reverse">
          {allSignatures
            .slice()
            .reverse()
            .map((sig) => {
              const shortSig = `${sig.slice(0, 4)}...${sig.slice(-4)}`;
              const sigExplorerUrl = `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
              const originalIndex = allSignatures.indexOf(sig);
              const isLatest = sig === allSignatures[allSignatures.length - 1];
              const delay = originalIndex * 60;
              const shouldAnimate = hasInteracted;

              return (
                <div
                  key={sig}
                  onClick={(e) => handleItemClick(e, sigExplorerUrl)}
                  className="flex items-center gap-1 px-1 text-xs font-mono rounded cursor-pointer text-white/70 hover:text-white hover:bg-white/10 overflow-hidden"
                  style={{
                    height: isLatest || isOpen ? '28px' : '0px',
                    opacity: isLatest ? 1 : isOpen ? 1 : 0,
                    transform: isLatest
                      ? 'none'
                      : isOpen
                        ? 'translateY(0) scale(1)'
                        : 'translateY(6px) scale(0.97)',
                    transition: shouldAnimate
                      ? `height 0.1s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, opacity 0s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 0s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`
                      : 'none',
                    pointerEvents: isLatest || isOpen ? 'auto' : 'none',
                  }}
                  title={sig}
                >
                  <span className="text-white/40">
                    Tx{originalIndex + 1}:
                  </span>
                  <span>{shortSig}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
