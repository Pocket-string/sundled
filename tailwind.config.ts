import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Lucvia: Dark theme with emerald accent (solar/energy)
        background: '#030712',      // gray-950
        surface: '#111827',          // gray-900
        'surface-hover': '#1f2937', // gray-800
        border: {
          DEFAULT: '#1f2937',       // gray-800
          light: '#374151',         // gray-700
        },
        foreground: {
          DEFAULT: '#f9fafb',       // gray-50
          secondary: '#9ca3af',     // gray-400
          muted: '#6b7280',         // gray-500
        },
        // Emerald primary (solar energy green)
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Status colors (matching heatmap semaphore)
        'status-green': '#10b981',  // string OK (>=95%)
        'status-yellow': '#f59e0b', // string warning (80-94%)
        'status-red': '#ef4444',    // string critical (<80%)
        'status-gray': '#6b7280',   // no data
        success: {
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.3)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.4)',
        'elevated': '0 10px 15px -3px rgb(0 0 0 / 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
