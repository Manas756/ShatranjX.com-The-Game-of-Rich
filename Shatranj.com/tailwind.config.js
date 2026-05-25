/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        deep: '#0a0a0f',
        gold: '#d4af37',
        goldLight: '#e8c468',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
