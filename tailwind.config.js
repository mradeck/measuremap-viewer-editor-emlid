/** Tailwind lokal gebündelt (vorher CDN). Palette: neutrales Grau/Blau wie in den übrigen öffentlichen Apps von Michael Radeck. */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './App.tsx', './InspectorApp.tsx', './components/**/*.tsx', './survey/**/*.tsx', './ui/**/*.tsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        gray: { 100: '#e6ebf1', 200: '#d5dce4', 300: '#b9c3cf', 400: '#93a0af', 500: '#6b7684', 600: '#4a5361', 700: '#333c48', 750: '#2a313b', 800: '#232a33', 850: '#1d2229', 900: '#1d2229', 950: '#14171c' },
        brand: { 300: '#8cc4ff', 400: '#6cb3ff', 500: '#4da3ff', 600: '#2f8be6', 900: '#0d2a4a' },
        green: { 400: '#46c07a', 500: '#3aa86a' },
        red: { 400: '#ec7a7a', 500: '#e05c5c', 900: '#3a1c1c' },
        yellow: { 500: '#e0a13c', 900: '#3a2a10' },
        orange: { 300: '#e0a13c', 500: '#d98a2b', 900: '#3a2610' },
        blue: { 400: '#4da3ff' },
      },
    },
  },
  plugins: [],
};
