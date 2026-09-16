import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        atleti: {
          bg: '#EFF2F9',
          surface: '#FFFFFF',
          mist: '#E4EBF1',
          line: '#E4EBF1',
          muted: '#B5BFC6',
          slate: '#6E7F8D',
          ink: '#2A3439',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(22,27,29,0.04), 0 8px 24px -12px rgba(22,27,29,0.12)',
        'soft-lg': '0 2px 4px rgba(22,27,29,0.05), 0 16px 40px -16px rgba(22,27,29,0.18)',
      },
    },
  },
  plugins: [],
}

export default config
