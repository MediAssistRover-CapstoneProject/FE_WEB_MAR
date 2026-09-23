/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "Segoe UI", "Arial", "sans-serif"],
      },
      colors: {
        mar: {
          primary: "#2F80FF",
          text: "#0F172A",
          muted: "#475569",
          subtle: "#F1F5F9",
          sidebar: "#F8FAFC",
          selected: "#DBEAFE",
          border: "#CBD5E1",
          surface: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};
