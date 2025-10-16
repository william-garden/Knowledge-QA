/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        sidebar: "#111827",
        surface: "#1f2937",
        accent: "#38bdf8",
        accentMuted: "#0ea5e9"
      }
    }
  },
  plugins: []
};
