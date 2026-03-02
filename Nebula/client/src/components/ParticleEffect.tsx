import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

export function DustParticles({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const count = 8 + Math.floor(Math.random() * 4);
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Math.random(),
        x: (Math.random() - 0.5) * 60,
        y: 0,
        size: 4 + Math.random() * 4,
        color: Math.random() > 0.5 ? "#555" : "#333",
      });
    }

    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 1000);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 overflow-visible pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: p.x,
            y: -20 - Math.random() * 20,
            opacity: 0,
            scale: 0
          }}
          transition={{
            duration: 0.4,
            ease: "circOut"
          }}
          className="absolute bg-zinc-500"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color
          }}
        />
      ))}
    </div>
  );
}