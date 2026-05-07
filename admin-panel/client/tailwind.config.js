/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#060910',
        surface: '#0d1117',
        surface2: '#161b22',
        accent: '#3b82f6',
        accent2: '#06b6d4',
        accent3: '#8b5cf6',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
