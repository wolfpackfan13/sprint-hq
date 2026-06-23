/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#080C14',
          900: '#0E1320',
          800: '#141B2D',
          700: '#1A2338',
          600: '#222D45',
          500: '#2D3C57',
          400: '#3D5070',
        },
        gold: {
          600: '#C47D0E',
          500: '#F4A825',
          400: '#F7BC55',
          300: '#FAD08A',
          200: '#FCECC4',
        },
        forest: {
          700: '#1A4A2E',
          600: '#1E5C38',
          500: '#2D7A50',
          400: '#3DAD6E',
          300: '#6DC98F',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
