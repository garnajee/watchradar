import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#eef2ff",
        night: "#080b14",
        panel: "#111726",
        muted: "#8e9ab4",
        coral: "#ff5c77",
        violet: "#8b5cf6",
        cyan: "#22d3ee"
      },
      boxShadow: {
        glow: "0 0 40px rgba(139, 92, 246, .18)",
        card: "0 18px 60px rgba(0, 0, 0, .28)"
      },
      animation: {
        "pulse-soft": "pulse 2.2s cubic-bezier(0.4,0,0.6,1) infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
