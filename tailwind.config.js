/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // DESIGN.md 색 토큰 (값은 src/index.css :root)
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        late: "var(--late)",
        "late-ink": "var(--late-ink)",
        early: "var(--early)",
        absent: "var(--absent)",
        ink: "var(--ink)",
        "ink-strong": "var(--ink-strong)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        raised: "var(--raised)",
        surface: "var(--surface)",
        paper: "var(--paper)",
      },
      // 움직임 곡선 하나 (DESIGN.md 7절, index.css --ease 와 같은 값)
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
