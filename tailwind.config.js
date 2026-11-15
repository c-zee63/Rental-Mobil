/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16231F',
        petrol: { DEFAULT: '#0E5A52', dark: '#0A433D', soft: '#D9EBE7' },
        mist: '#EDF0EE',
        line: '#D5DCD8',
        amber: { DEFAULT: '#D99A1E', soft: '#FBF0D6' },
        signal: { DEFAULT: '#C93A2B', soft: '#FAE4E0' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
