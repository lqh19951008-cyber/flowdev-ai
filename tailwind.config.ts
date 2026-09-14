import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: {
          bg: "#0b0f19",
          dot: "#1e293b",
          panel: "#111827",
          border: "#1f2937",
          hover: "#374151",
          active: "#2563eb",
        }
      },
    },
  },
  plugins: [],
};
export default config;
