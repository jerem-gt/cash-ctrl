/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        serif: ['DM Serif Display', 'serif'],
      },
      colors: {
        brand: {
          50:  '#eaf2e2',
          100: '#d0e6b8',
          400: '#7DBB4A',
          600: '#5A8A2A',
          800: '#2C4F0E',
        },
      },
    },
  },
  plugins: [],
};
