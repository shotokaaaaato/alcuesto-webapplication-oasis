/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        oasis: {
          dark: "#0a0a0f",
          surface: "#14141f",
          border: "#1e1e2e",
          accent: "#22d3ee",
          green: "#34d399",
        },
      },
    },
  },
  plugins: [],
};
