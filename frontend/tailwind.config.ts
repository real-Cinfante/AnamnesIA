import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Forest green palette — "Verdad Clínica"
        forest: {
          950: "#071511",
          900: "#0D2218",
          800: "#1C3D2F",
          700: "#245040",
          600: "#2E6B4F",
          500: "#3A8562",
          400: "#4EA87D",
          300: "#72C49A",
          200: "#95D6B8",
          100: "#C6ECD9",
          50:  "#F0FAF5",
        },
        // Warm neutrals
        cream:     "#F8F6F2",
        parchment: "#F0EDE7",
        border:    "#E4DDD3",
        ink:       "#111714",
        stone:     "#847870",
        // Legacy aliases for compatibility
        "pale-green": "#F0FAF5",
        // Semantic tokens
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",
        // Sidebar
        sidebar: {
          bg:     "hsl(var(--sidebar-bg))",
          text:   "hsl(var(--sidebar-text))",
          muted:  "hsl(var(--sidebar-muted))",
          active: "hsl(var(--sidebar-active))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      borderRadius: {
        sm:    "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md:    "var(--radius)",
        lg:    "var(--radius-lg)",
        xl:    "calc(var(--radius-lg) + 4px)",
        "2xl": "calc(var(--radius-lg) + 8px)",
        full:  "9999px",
      },
      backgroundImage: {
        "brand-gradient":  "linear-gradient(135deg, #1C3D2F 0%, #4EA87D 100%)",
        "forest-gradient": "linear-gradient(135deg, #1C3D2F 0%, #4EA87D 100%)",
        "forest-radial":   "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(78,168,125,0.15) 0%, transparent 70%)",
      },
      boxShadow: {
        xs:           "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        sm:           "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        DEFAULT:      "0 2px 6px -1px rgb(0 0 0 / 0.08), 0 1px 4px -2px rgb(0 0 0 / 0.06)",
        md:           "0 4px 10px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.05)",
        lg:           "0 8px 24px -4px rgb(0 0 0 / 0.08), 0 4px 10px -4px rgb(0 0 0 / 0.05)",
        card:         "0 1px 3px 0 rgb(28 61 47 / 0.08), 0 1px 2px -1px rgb(28 61 47 / 0.06)",
        "card-hover": "0 4px 16px 0 rgb(28 61 47 / 0.12), 0 2px 6px -2px rgb(28 61 47 / 0.08)",
        forest:       "0 4px 16px 0 rgb(78 168 125 / 0.25)",
        "forest-sm":  "0 2px 8px 0 rgb(78 168 125 / 0.18)",
        inner:        "inset 0 1px 3px 0 rgb(0 0 0 / 0.06)",
        // Legacy
        "teal-sm":    "0 2px 8px 0 rgb(78 168 125 / 0.18)",
        teal:         "0 4px 16px 0 rgb(78 168 125 / 0.25)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.35" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        waveform: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%":      { transform: "scaleY(1)" },
        },
        "recording-ring": {
          "0%":   { transform: "scale(1)",   opacity: "0.6" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "fade-in":        "fade-in 0.2s ease-out",
        "fade-up":        "fade-up 0.4s ease-out both",
        "fade-up-delay":  "fade-up 0.4s 0.15s ease-out both",
        "fade-up-delay2": "fade-up 0.4s 0.3s ease-out both",
        "pulse-dot":      "pulse-dot 1.5s ease-in-out infinite",
        shimmer:          "shimmer 1.6s linear infinite",
        "scale-in":       "scale-in 0.15s ease-out",
        waveform:         "waveform 1.2s ease-in-out infinite",
        "recording-ring": "recording-ring 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
