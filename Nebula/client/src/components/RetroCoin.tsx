import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";

interface RetroCoinProps {
  rotationY?: number;
  size?: number;
  className?: string;
  gameState?: "idle" | "flipping" | "result";
  onRotationChange?: (rotation: number) => void;
  onHoverChange?: (isHovered: boolean) => void;
  isInitialAnimationPlaying?: boolean;
}

export function RetroCoin({ rotationY: initialRotationY = 0, size = 128, className = "", gameState = "idle", onRotationChange, onHoverChange, isInitialAnimationPlaying = false }: RetroCoinProps) {
  const [localRotationY, setLocalRotationY] = useState(initialRotationY);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const coinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameState !== "idle") {
      setHasUserInteracted(false);
    }
  }, [gameState]);

  useEffect(() => {
    if (!hasUserInteracted) {
      setLocalRotationY(initialRotationY);
    }
  }, [initialRotationY, hasUserInteracted]);


  const glossyHighlight = "radial-gradient(ellipse 80% 50% at 30% 20%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 40%, transparent 70%)";

  const faceStyle = "absolute inset-1 rounded-full border-[3px] border-black/90";

  const coinDepth = 24;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (gameState === "idle" && !isInitialAnimationPlaying) {
      setIsDragging(true);
      setHasUserInteracted(true);
      setLastMouseX(e.clientX);
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && gameState === "idle") {
        const deltaX = e.clientX - lastMouseX;
        const rotationDelta = deltaX * 0.5;
        const newRotation = (localRotationY + rotationDelta) % 360;
        setLocalRotationY(newRotation);
        setLastMouseX(e.clientX);
        onRotationChange?.(newRotation);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && gameState === "idle" && e.touches.length === 1) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastMouseX;
        const rotationDelta = deltaX * 0.5;
        const newRotation = (localRotationY + rotationDelta) % 360;
        setLocalRotationY(newRotation);
        setLastMouseX(touch.clientX);
        onRotationChange?.(newRotation);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setTimeout(() => setHasUserInteracted(false), 100);
    };

    const handleGlobalTouchEnd = () => {
      setIsDragging(false);
      setTimeout(() => setHasUserInteracted(false), 100);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove);
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, gameState, lastMouseX, localRotationY, onRotationChange]);

  const handleMouseEnter = () => {
    if (gameState === "idle" && !isInitialAnimationPlaying) {
      setIsHovered(true);
      onHoverChange?.(true);
    }
  };

  const handleMouseLeave = () => {
    if (gameState === "idle" && !isInitialAnimationPlaying) {
      setIsHovered(false);
      onHoverChange?.(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState === "idle" && !isInitialAnimationPlaying && e.touches.length === 1) {
      setIsDragging(true);
      setHasUserInteracted(true);
      setLastMouseX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const currentRotationY = localRotationY;

  return (
    <motion.div
      ref={coinRef}
      className={`relative inline-block ${className} ${gameState === "idle" && !isInitialAnimationPlaying ? "cursor-grab" : ""} ${isDragging ? "cursor-grabbing" : ""}`}
      style={{ touchAction: 'none' }}
      whileHover={gameState === "idle" && !isInitialAnimationPlaying ? {
        y: -7,
      } : {}}
      transition={{
        duration: 0.2,
        ease: "easeInOut"
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="relative inline-block"
        style={{
          width: size,
          height: size,
          perspective: 'none',
          filter: 'drop-shadow(0px 0px 8px rgba(0, 0, 0, 0.4)) drop-shadow(0px 0px 16px rgba(0, 0, 0, 0.25)) drop-shadow(0px 0px 24px rgba(0, 0, 0, 0.1))'
        }}
      >
        <div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${currentRotationY}deg)`
          }}
        >
          <div
            className={faceStyle}
            style={{
              background: `linear-gradient(135deg, #8B5CF6 0%, #10B981 40%, #059669 70%, #8B5CF6 100%)`,
              transform: `translateZ(${coinDepth / 2}px)`,
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)'
            }}
          >
            <div
              className="absolute inset-0 rounded-full pointer-events-none shadow-lg shadow-black/70"
              style={{ background: glossyHighlight }}
            />

            <div className="absolute inset-0 flex items-center justify-center select-none z-20">
              <img
                src="/solana.png"
                alt="Solana"
                className="w-20 h-20 object-contain drop-shadow-lg"
              />
            </div>
          </div>

          <div
            className={faceStyle}
            style={{
              background: `linear-gradient(135deg, #8B5CF6 0%, #10B981 40%, #059669 70%, #8B5CF6 100%)`,
              transform: `translateZ(-${coinDepth / 2}px) rotateY(180deg)`,
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)'
            }}
          >
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: glossyHighlight }}
            />

            <div className="absolute inset-0 flex items-center justify-center select-none z-20">
              <img
                src="/nebula.png"
                alt="Nebula"
                className="w-24 h-24 object-contain drop-shadow-lg"
              />
            </div>
          </div>

          {[...Array(180)].map((_, i) => {
            const angle = i * 2;
            
            const lightAngle = ((angle + 45) % 360);
            const lightIntensity = Math.cos((lightAngle * Math.PI) / 180);
            const brightness = 0.6 + (lightIntensity * 0.4);
            
            const colorPhase = (angle % 180) / 180;
            const purple = { r: 136, g: 58, b: 237 };
            const green = { r: 16, g: 150, b: 70 };
            
            const baseColor = {
              r: Math.round((purple.r + (green.r - purple.r) * colorPhase) * brightness),
              g: Math.round((purple.g + (green.g - purple.g) * colorPhase) * brightness),
              b: Math.round((purple.b + (green.b - purple.b) * colorPhase) * brightness)
            };

            return (
              <div
                key={i}
                className="absolute"
                style={{
                  width: 6,
                  height: coinDepth,
                  left: '50%',
                  top: '50%',
                  marginLeft: -3,
                  marginTop: -coinDepth / 2,
                  background: `linear-gradient(to right,
                    rgb(${Math.max(0, baseColor.r - 20)}, ${Math.max(0, baseColor.g - 20)}, ${Math.max(0, baseColor.b - 20)}) 0%,
                    rgb(${Math.min(255, baseColor.r + 30)}, ${Math.min(255, baseColor.g + 30)}, ${Math.min(255, baseColor.b + 30)}) 50%,
                    rgb(${Math.max(0, baseColor.r - 20)}, ${Math.max(0, baseColor.g - 20)}, ${Math.max(0, baseColor.b - 20)}) 100%
                  )`,
                  transformOrigin: `50% 50%`,
                  transform: `rotateX(90deg) rotateY(${angle}deg) translateZ(${(size / 2) - 4}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}