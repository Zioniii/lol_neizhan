/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
          '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        accent: {
          blue: '#007AFF',
          purple: '#AF52DE',
          indigo: '#5856D6',
          teal: '#5AC8FA',
        },
        glass: {
          light: 'rgba(255,255,255,0.72)',
          dark: 'rgba(255,255,255,0.45)',
          border: 'rgba(255,255,255,0.55)',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        soft: '0 2px 20px rgba(0,0,0,0.06)',
        card: '0 4px 32px rgba(0,0,0,0.08)',
        lift: '0 8px 40px rgba(0,0,0,0.10)',
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-blue': 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
      },
    },
  },
  plugins: [],
}
