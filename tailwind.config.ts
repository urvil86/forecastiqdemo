import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#C98B27",
          dark: "#A26F1C",
          light: "#F4E6CC",
        },
        secondary: {
          DEFAULT: "#004466",
          light: "#0A5C82",
        },
        background: "#FAF9F5",
        surface: "#FFFFFF",
        foreground: "#171717",
        muted: "#5C6770",
        border: "#E6E1D6",
        success: "#1F8A5C",
        warning: "#E5A04B",
        danger: "#C1423B",
        info: "#3B82C4",
        "input-cell-bg": "#FFF3C4",
        "computed-cell-bg": "#FFFFFF",
        "bound-cell-bg": "#D6E4EE",
      },
      fontFamily: {
        heading: ["Lato", "system-ui", "sans-serif"],
        body: ["'Open Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        h1: ["48px", { lineHeight: "1.1", fontWeight: "900" }],
        h2: ["32px", { lineHeight: "1.15", fontWeight: "800" }],
        h3: ["24px", { lineHeight: "1.2", fontWeight: "700" }],
        h4: ["18px", { lineHeight: "1.3", fontWeight: "700" }],
      },
      borderRadius: {
        xl: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
