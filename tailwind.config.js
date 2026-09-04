/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "hsl(var(--ink))",
        canvas: "hsl(var(--canvas))",
        panel: "hsl(var(--panel))",
        line: "hsl(var(--line))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        danger: "hsl(var(--danger))"
      },
      boxShadow: {
        "soft-glow": "0 16px 50px hsl(var(--accent) / 0.12)"
      },
      borderRadius: {
        card: "1.25rem",
        control: "0.9rem"
      }
    }
  },
  plugins: []
};
