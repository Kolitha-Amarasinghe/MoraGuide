/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        paper: '#f8f6f0',
        violet: '#5e5ce6'
      },
      fontFamily: {
        sans: ['DM Sans', 'Manrope', 'sans-serif']
      },
      boxShadow: {
        card: '0 12px 35px rgba(15, 23, 42, .06)'
      }
    }
  },
  plugins: []
};
