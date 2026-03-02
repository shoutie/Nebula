import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  isLoading?: boolean;
}

export function RetroButton({
  className,
  variant = "primary",
  children,
  isLoading,
  disabled,
  ...props
}: RetroButtonProps) {
  return (
    <button
      className={cn(
        "relative group font-pixel text-sm uppercase px-8 py-4 transition-transform active:translate-y-1 outline-none focus:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      <div className={cn(
        "absolute inset-0 border-4 border-black bg-white transition-colors duration-0",
        variant === "primary" ? "bg-[#FFD700] group-hover:bg-[#FFED4A]" : "bg-zinc-700 text-white group-hover:bg-zinc-600"
      )}>
        <div className="absolute inset-0 border-t-4 border-l-4 border-white/40 pointer-events-none"></div>
        <div className="absolute inset-0 border-b-4 border-r-4 border-black/20 pointer-events-none"></div>
      </div>

      <span className={cn(
        "relative z-10 flex items-center gap-2",
        variant === "primary" ? "text-black" : "text-white"
      )}>
        {isLoading ? "FLIPPING..." : children}
      </span>

      <div className="absolute top-1 left-1 w-full h-full bg-black -z-10 translate-x-1 translate-y-1"></div>
    </button>
  );
}