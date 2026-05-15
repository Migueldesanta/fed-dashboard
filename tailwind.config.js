/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0e1a',
          surface: '#0f1629',
          border: '#1e2d4a',
          accent: '#00d4ff',
          green: '#00ff88',
          red: '#ff3366',
          amber: '#ffaa00',
          muted: '#4a5568',
          text: '#e2e8f0',
          dim: '#718096',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      }
    }
  },
  plugins: []
}
