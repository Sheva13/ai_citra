/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        muted: "#64748B",
        hairline: "#E6EAF0",
        paper: "#F6F7F9",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.05)",
      },
    },
  },
  plugins: [],
};
