/** @type {import('tailwindcss').Config} */

/* ==========================================================================
   IoTShield Verify — Tailwind theme
   --------------------------------------------------------------------------
   Two colour systems live here and they do different jobs:

   1. UI CHROME — `navy`, `brand`, `ice`, `violet` and the status colours
      (ok / warn / bad). These paint the product surface: panels, buttons,
      badges, rails. Status colours are RESERVED — they never double as a
      chart series, and they always ship next to an icon and a text label so
      meaning never rests on hue alone.

   2. DATA SERIES — `series.1` … `series.8`. A fixed-order categorical
      palette validated against the chart surface (#0F1A2F): every slot sits
      inside the OKLCH lightness band 0.48–0.67, clears a 0.1 chroma floor,
      holds >= 3:1 contrast against the surface, and the worst *adjacent*
      pair separates at deltaE 12.9 under simulated protanopia (>= 8 target)
      and 18.3 under normal vision (>= 15 floor).

      Slot order is the colour-blind-safety mechanism, not decoration.
      Assign series in fixed order; never cycle, and never repaint the
      survivors when a filter changes the series count.
   ========================================================================== */

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060A12', // app void
          900: '#080E1A', // page plane
          880: '#0A1220', // rail / chrome
          850: '#0C1526', // sunken well
          800: '#0F1A2F', // card + chart surface
          750: '#132340', // raised card
          700: '#16264A', // hover / active
          600: '#1C2C48', // strong border
          500: '#263A5C', // baseline / axis
        },
        brand: {
          50: '#EFF6FF',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          DEFAULT: '#3B82F6',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        ice: {
          300: '#67E8F9',
          DEFAULT: '#22D3EE',
          400: '#22D3EE',
          500: '#06B6D4',
        },
        violet: {
          300: '#C4B5FD',
          DEFAULT: '#A78BFA',
          400: '#A78BFA',
          500: '#8B5CF6',
        },
        /* Reserved status palette — icon + label always accompany these. */
        ok: '#22C55E',
        warn: '#F59E0B',
        bad: '#F04438',
        info: '#5B87B8',

        /* Ink scale for text on the navy plane. */
        ink: {
          100: '#EAF1FF', // primary
          300: '#A7B4CC', // secondary
          500: '#6B7A99', // muted (axis ticks, meta)
          700: '#43506B', // disabled
        },

        /* Validated categorical chart palette — fixed order. */
        series: {
          1: '#2E90FA', // blue
          2: '#DD6320', // orange
          3: '#12A88F', // teal
          4: '#B58700', // amber
          5: '#D9589A', // magenta
          6: '#118A33', // green
          7: '#8878E6', // violet
          8: '#E45855', // red
        },

        /* Single-hue sequential ramp for magnitude encodings. */
        seq: {
          100: '#CDE2FB',
          200: '#9EC5F4',
          300: '#6DA7EC',
          400: '#3987E5',
          500: '#256ABF',
          600: '#184F95',
          700: '#0D366B',
        },

        grid: '#1B2942',
      },
      fontFamily: {
        sans: [
          'Inter Variable',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        glass:
          'inset 0 1px 0 0 rgb(255 255 255 / 0.04), 0 12px 32px -12px rgb(0 0 0 / 0.65)',
        raise:
          'inset 0 1px 0 0 rgb(255 255 255 / 0.05), 0 20px 48px -16px rgb(0 0 0 / 0.75)',
        glow: '0 0 0 1px rgb(59 130 246 / 0.30), 0 0 28px -6px rgb(59 130 246 / 0.45)',
        'glow-bad':
          '0 0 0 1px rgb(240 68 56 / 0.35), 0 0 28px -6px rgb(240 68 56 / 0.50)',
      },
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgb(240 68 56 / 0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgb(240 68 56 / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(240 68 56 / 0)' },
        },
        'dash-flow': {
          to: { strokeDashoffset: '-24' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '40%': { opacity: '0.55' },
          '100%': { transform: 'translateY(220%)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'dash-flow': 'dash-flow 0.8s linear infinite',
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scan-line': 'scan-line 3.2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
      },
    },
  },
  plugins: [],
}
