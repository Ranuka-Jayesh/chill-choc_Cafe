/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "#1FB5AE",
          "teal-dark": "#138E89",
          "teal-light": "#E8F8F7",
          yellow: "#F3B33D",
          "yellow-light": "#FEF8EC",
          orange: "#E99343",
          brown: "#875136",
          "brown-dark": "#5C3528",
          "brown-deep": "#3D2319",
        },
        cream: {
          50: "#FFFCF5",
          100: "#F8F0DF",
          200: "#EFE1C7",
          300: "#E2D0B0",
        },
        bg: {
          DEFAULT: "#FFFDF9",
          soft: "#FAF6ED",
          card: "#FFFFFF",
        },
        text: {
          primary: "#392A25",
          secondary: "#74645B",
          muted: "#9D8F87",
        },
        border: {
          DEFAULT: "#E9E0D5",
          strong: "#D6C7B7",
        },
        status: {
          success: "#2E9A67",
          "success-bg": "#EBF7F0",
          warning: "#D89428",
          "warning-bg": "#FEF7E8",
          danger: "#D6534D",
          "danger-bg": "#FDF0F0",
          info: "#2B87D1",
          "info-bg": "#EBF4FC",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Nunito Sans", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
      },
      boxShadow: {
        soft: "0 2px 10px rgba(92, 53, 40, 0.04), 0 1px 3px rgba(92, 53, 40, 0.06)",
        card: "0 4px 20px rgba(92, 53, 40, 0.06)",
        elevated: "0 10px 30px rgba(92, 53, 40, 0.1)",
        teal: "0 4px 14px rgba(31, 181, 174, 0.35)",
        yellow: "0 4px 14px rgba(243, 179, 61, 0.35)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
}
