/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50:  '#FFFFFF',
          100: '#F7F8FC',
          200: '#F0F2F8',
          300: '#E4E7EF',
          400: '#CDD3E0',
          500: '#9BA5BB',
        },
        navy: {
          900: '#0D1526',
          800: '#1A2540',
          700: '#2E3D5A',
          600: '#475C7A',
          500: '#6B7FA0',
          400: '#9AAAC4',
          300: '#C5CEDF',
        },
        gold: {
          700: '#A86800',
          600: '#C47D0E',
          500: '#F4A825',
          400: '#F7BC55',
          300: '#FAD08A',
          100: '#FEF6E4',
          50:  '#FFFBF0',
        },
        forest: {
          700: '#1A4A2E',
          600: '#1E5C38',
          500: '#2D7A50',
          400: '#3DAD6E',
          300: '#7DCB9E',
          100: '#DCFCE7',
          50:  '#F0FDF4',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}
