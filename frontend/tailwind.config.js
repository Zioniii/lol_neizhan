/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Chakra Petch', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Russo One', 'sans-serif'],
        body: ['Chakra Petch', 'sans-serif'],
      },
      colors: {
        base: {
          DEFAULT: '#0B1120',
          lighter: '#0F172A',
          light: '#1E293B',
        },
        surface: {
          DEFAULT: '#1E293B',
          light: '#253248',
          lighter: '#2D3A50',
          hover: '#263348',
        },
        accent: {
          blue: '#3B82F6',
          indigo: '#6366F1',
          amber: '#F59E0B',
          emerald: '#22C55E',
          rose: '#F43F5E',
        },
        border: {
          DEFAULT: '#334155',
          light: '#3B4A5E',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.3)',
        elevated: '0 4px 16px rgba(0,0,0,0.4)',
        'elevated-lg': '0 8px 32px rgba(0,0,0,0.5)',
        glow: '0 0 12px rgba(59,130,246,0.12)',
      },
    },
  },
  plugins: [],
}
