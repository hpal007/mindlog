import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Calm, non-clinical palette — warm slate + sage, AA-contrast tuned.
        ink: "#1c2433",
        sage: {
          50: "#f1f6f3",
          100: "#dcebe2",
          400: "#5e9b7e",
          500: "#3f7d61",
          600: "#2f6149",
        },
        clay: {
          400: "#d98a6a",
          500: "#c46a4a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
