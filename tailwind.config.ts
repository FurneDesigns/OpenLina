import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d10',
        surface: '#13161b',
        surfaceAlt: '#191d24',
        border: '#252a33',
        text: '#e6e8ec',
        muted: '#8a93a3',
        accent: '#7c5cff',
        success: '#3ddc84',
        warn: '#f5a623',
        danger: '#ff5577',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
