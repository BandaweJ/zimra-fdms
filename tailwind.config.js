/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zimra: {
          gold: {
            DEFAULT: 'var(--zimra-gold)',
            light: 'var(--zimra-gold-light)',
            dark: 'var(--zimra-gold-dark)',
          },
          charcoal: {
            DEFAULT: 'var(--zimra-charcoal)',
            light: 'var(--zimra-charcoal-light)',
            dark: 'var(--zimra-charcoal-dark)',
          },
          surface: {
            DEFAULT: 'var(--zimra-surface)',
            dark: 'var(--zimra-surface-dark)',
          },
          border: {
            DEFAULT: 'var(--zimra-border)',
            dark: 'var(--zimra-border-dark)',
          },
        },
        status: {
          grey: 'var(--status-grey)',
          yellow: 'var(--status-yellow)',
          red: 'var(--status-red)',
          green: 'var(--status-green)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
  ],
}

