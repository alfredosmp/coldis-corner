/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Quicksand"', 'system-ui', 'sans-serif'],
        display: ['"Quicksand"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Lora"', 'Georgia', 'serif'],
      },
      colors: {
        lavender: {
          50: '#FAF7FD',
          100: '#F3ECFA',
          200: '#E7D8F6',
          300: '#D4B8EE',
          400: '#BA8EE4',
          500: '#9E64D8',
          600: '#8444C2',
          700: '#6D33A3',
          800: '#5A2C85',
          900: '#49256B',
          950: '#2A1340',
        },
        midnight: {
          950: '#130E1B',
          900: '#1B1426',
          850: '#221A30',
          800: '#2A203B',
          700: '#392C50',
        },
        blush: {
          50: '#FFF5F9',
          100: '#FFE8F1',
          200: '#FFD0E3',
          300: '#FFA8CC',
          400: '#F472B6',
          500: '#E24C98',
        },
      },
      boxShadow: {
        soft: '0 8px 28px -8px rgba(132, 68, 194, 0.12)',
        'soft-lg': '0 16px 40px -12px rgba(132, 68, 194, 0.18)',
        'midnight-soft': '0 10px 30px -10px rgba(0, 0, 0, 0.45)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
