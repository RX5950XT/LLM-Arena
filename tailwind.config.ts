import type { Config } from 'tailwindcss'

const token = (name: string): string => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        sunken: token('sunken'),
        panel: token('panel'),
        raised: token('raised'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        muted: token('muted'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        'accent-text': token('accent-text'),
        pro: token('pro'),
        con: token('con'),
        warn: token('warn'),
        danger: token('danger'),
        ok: token('ok')
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Noto Sans TC', '-apple-system', 'BlinkMacSystemFont', 'Microsoft JhengHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      },
      boxShadow: {
        pop: '0 12px 32px -8px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.16)'
      }
    }
  },
  plugins: []
}

export default config
