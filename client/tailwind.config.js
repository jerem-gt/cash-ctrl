/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'sans-serif'],
        display: ['Manrope Variable', 'Manrope', 'sans-serif'],
      },
      colors: {
        // ─── Tokens sémantiques (theme-aware via variables CSS dans index.css) ───
        // Pour ajuster une teinte clair/sombre, éditer la variable correspondante,
        // pas les classes des composants.
        canvas: 'var(--c-canvas)',
        surface: {
          DEFAULT: 'var(--c-surface)',
          muted: 'var(--c-surface-muted)',
          emphasis: 'var(--c-surface-emphasis)',
          strong: 'var(--c-surface-strong)',
        },
        inverse: {
          DEFAULT: 'var(--c-inverse)',
          fg: 'var(--c-inverse-fg)',
        },
        content: {
          DEFAULT: 'var(--c-content)',
          secondary: 'var(--c-content-secondary)',
          muted: 'var(--c-content-muted)',
          subtle: 'var(--c-content-subtle)',
          faint: 'var(--c-content-faint)',
        },
        line: {
          DEFAULT: 'var(--c-line)',
          subtle: 'var(--c-line-subtle)',
          strong: 'var(--c-line-strong)',
        },
        success: {
          DEFAULT: 'var(--c-success)',
          surface: 'var(--c-success-surface)',
        },
        danger: {
          DEFAULT: 'var(--c-danger)',
          surface: 'var(--c-danger-surface)',
        },
        warning: {
          DEFAULT: 'var(--c-warning)',
          surface: 'var(--c-warning-surface)',
        },
        info: {
          DEFAULT: 'var(--c-info)',
          surface: 'var(--c-info-surface)',
        },
        // ─── Couleur de marque (identique dans les deux thèmes) ───
        brand: {
          50: '#ECFDFE',
          100: '#CBF3F7',
          200: '#A5E9F0',
          400: '#2CC5DD',
          500: '#139AAE',
          600: '#0D8896',
          700: '#0B6B7A',
          800: '#11555F',
        },
        sidebar: {
          bg: '#102E3A',
          fg: '#F4F1EB',
          accent: '#2CC5DD',
        },
      },
    },
  },
  plugins: [],
};
