import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#102033",
        mist: "#eef4f7",
        tide: "#d7e6ec",
        surf: "#69a8ba",
        pine: "#12343b",
        sand: "#f5efe3",
        coral: "#f08a64",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(16, 32, 51, 0.08)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(16, 32, 51, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 32, 51, 0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
