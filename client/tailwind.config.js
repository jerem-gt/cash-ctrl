/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'sans-serif'],
        display: ['Manrope Variable', 'Manrope', 'sans-serif'],
      },
      colors: {
        canvas: '#EAEEF2',
        brand: {
          50: '#ECFDFE',
          100: '#CBF3F7',
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
