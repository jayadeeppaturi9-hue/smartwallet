/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Central Forensic Tokens mapped to CSS variables
        'forensic-bg': 'var(--forensic-bg)',
        'forensic-surface': 'var(--forensic-surface)',
        'forensic-surface-2': 'var(--forensic-surface-2)',
        'forensic-border': 'var(--forensic-border)',
        'forensic-border-subtle': 'var(--forensic-border-subtle)',
        'forensic-text': 'var(--forensic-text)',
        'forensic-muted': 'var(--forensic-muted)',

        // Semantic Role Colors
        'forensic-target': 'var(--forensic-target)',
        'forensic-direct': 'var(--forensic-direct)',
        'forensic-intermediary': 'var(--forensic-intermediary)',
        'forensic-vasp': 'var(--forensic-vasp)',
        'forensic-danger': 'var(--forensic-danger)',
        'forensic-success': 'var(--forensic-success)',
        'forensic-warning': 'var(--forensic-warning)',

        // Standard App Semantic Aliases
        background: 'var(--forensic-bg)',
        surface: 'var(--forensic-surface)',
        'surface-card': 'var(--forensic-surface-2)',
        'surface-hover': '#16223b',
        'surface-border': 'var(--forensic-border)',
        'surface-border-subtle': 'var(--forensic-border-subtle)',
        border: 'var(--forensic-border)',

        // Calibrated Dark Forensic Palette for seamless sitewide alignment
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#8292ab', // calibrated forensic muted
          500: '#62728d',
          600: '#41516c',
          700: '#27354d',
          800: '#1d283e', // standard forensic border
          850: '#162033', // subtle card border
          900: '#0c1220', // forensic elevated surface
          950: '#070b14', // forensic deep canvas
        },

        accent: {
          cyan: '#06b6d4',      // Target Wallet Primary
          emerald: '#059669',   // Direct Counterparty
          teal: '#14b8a6',
          violet: '#7c3aed',    // Intermediary Wallet
          purple: '#8b5cf6',
          amber: '#d97706',     // Verified VASP
          orange: '#f59e0b',
          rose: '#e11d48',      // High Risk / Threat
          red: '#ef4444',
          blue: '#0284c7',
          indigo: '#4f46e5',
        },
        risk: {
          critical: '#e11d48',
          high: '#f59e0b',
          medium: '#d97706',
          low: '#059669',
          info: '#06b6d4',
        },
        text: {
          primary: '#e7edf7',
          secondary: '#8292ab',
          muted: '#62728d',
          dim: '#41516c',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -5px rgba(6, 182, 212, 0.35)',
        'glow-emerald': '0 0 20px -5px rgba(5, 150, 105, 0.35)',
        'glow-violet': '0 0 20px -5px rgba(124, 58, 237, 0.35)',
        'glow-amber': '0 0 20px -5px rgba(217, 119, 6, 0.35)',
        'glow-subtle': '0 4px 20px -2px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
