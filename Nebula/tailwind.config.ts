import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem",
        md: ".375rem",
        sm: ".1875rem",
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "drop-in": {
          "0%": {
            opacity: "1",
            transform: "translateY(5px) scale(1.2)",
            borderRadius: "60% 60% 40% 40%",
          },
          "50%": {
            opacity: "1",
            transform: "translateY(-5px) scale(1)",
            borderRadius: "60% 60% 40% 40%",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0px) scale(1)",
            borderRadius: "50%",
          },
        },
        "drip": {
          "0%": {
            transform: "scale(1)",
          },
          "50%": {
            transform: "scale(1.05)",
          },
          "100%": {
            transform: "scale(1)",
          },
        },
        "ripple": {
          "0%": {
            transform: "scale(0.8) translateY(0px)",
            opacity: "0.8",
          },
          "50%": {
            transform: "scale(1.3) translateY(0px)",
            opacity: "0.6",
          },
          "100%": {
            transform: "scale(2) translateY(0px)",
            opacity: "0",
          },
        },
        "button-to-drop": {
          "0%": {
            transform: "scale(1) translateY(0px)",
            borderRadius: "50%",
          },
          "50%": {
            transform: "scale(1.2) translateY(3px)",
            borderRadius: "60% 60% 40% 40%",
          },
          "100%": {
            transform: "scale(1.2) translateY(5px)",
            borderRadius: "60% 60% 40% 40%",
          },
        },
        "unified-dropdown-open": {
          "0%": {
            width: "40px",
            height: "40px",
            borderRadius: "100%",
            transform: "scale(1)",
          },
          "30%": {
            width: "48px",
            height: "48px",
            borderRadius: "0.375rem 0.375rem 0 0",
            transform: "scale(1)",
          },
          "70%": {
            width: "240px",
            height: "147px",
            borderRadius: "0.375rem",
            transform: "scale(1)",
          },
          "100%": {
            width: "240px",
            height: "147px",
            borderRadius: "0.375rem",
            transform: "scale(1)",
          },
        },
        "unified-dropdown-close": {
          "0%": {
            width: "240px",
            height: "147px",
            borderRadius: "0.375rem",
            transform: "scale(1)",
          },
          "30%": {
            width: "240px",
            height: "147px",
            borderRadius: "0.375rem 0.375rem 0 0",
            transform: "scale(1)",
          },
          "70%": {
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            transform: "scale(1)",
          },
          "100%": {
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            transform: "scale(1)",
          },
        },
        "twitter-dropdown-open": {
          "0%": {
            width: "64px",
            height: "64px",
            borderRadius: "100%",
            transform: "scale(1)",
          },
          "30%": {
            width: "72px",
            height: "72px",
            borderRadius: "0.375rem 0.375rem 0 0",
            transform: "scale(1)",
          },
          "70%": {
            width: "180px",
            height: "130px",
            borderRadius: "0.375rem",
            transform: "scale(1)",
          },
          "100%": {
            width: "180px",
            height: "130px",
            borderRadius: "0.375rem",
            transform: "scale(1)",
          },
        },
        "twitter-dropdown-close": {
          "0%": {
            width: "180px",
            height: "130px",
            borderRadius: "0.375rem",
            transform: "scale(1)",
          },
          "30%": {
            width: "180px",
            height: "130px",
            borderRadius: "0.375rem 0.375rem 0 0",
            transform: "scale(1)",
          },
          "70%": {
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            transform: "scale(1)",
          },
          "100%": {
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            transform: "scale(1)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.1s ease-out",
        "accordion-up": "accordion-up 0.1s ease-out",
        "drop-in": "drop-in 0.6s ease-out",
        "drip": "drip 2s ease-in-out infinite",
        "ripple": "ripple 0.6s ease-out",
        "button-to-drop": "button-to-drop 0.6s ease-out forwards",
        "unified-dropdown-open": "unified-dropdown-open 0.3s ease-out forwards",
        "unified-dropdown-close": "unified-dropdown-close 0.4s ease-out forwards",
        "twitter-dropdown-open": "twitter-dropdown-open 0.3s ease-out forwards",
        "twitter-dropdown-close": "twitter-dropdown-close 0.4s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
