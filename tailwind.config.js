/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#ffffff',
          500: '#ffffff',
          600: '#f4f4f5',
          700: '#e4e4e7',
          800: '#27272a',
          900: '#18181b',
          accent: '#ffffff',
        },
        dark: {
          bg: '#000000',
          surface: '#09090b',
          card: '#121214',
          hover: '#27272a',
          border: '#27272a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
