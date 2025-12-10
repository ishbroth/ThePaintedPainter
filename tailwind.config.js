/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a365d', // Dark blue
          light: '#2c5282',
          dark: '#0d1b2a',
        },
        secondary: {
          DEFAULT: '#c9a227', // Gold
          light: '#d4b84a',
          dark: '#a68b1f',
        },
        accent: {
          DEFAULT: '#e53e3e', // Red accent
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
