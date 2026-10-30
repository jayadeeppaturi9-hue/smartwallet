/**
 * Central Forensic Color System
 * Maps 1:1 with CSS variables in src/index.css and Tailwind config.
 *
 * Semantic Hierarchy:
 * - Target Subject: Cyan
 * - Direct Counterparty (1-Hop): Emerald / Teal
 * - Intermediary Wallet (2+ Hops): Violet / Purple
 * - Verified VASP Entity: Amber / Orange
 * - High Risk / Threat: Red / Rose
 * - Neutral Surfaces: Deep Forensic Slate / Carbon
 */

export const FORENSIC_THEME = {
  // Neutral Surfaces
  bg: '#070b14',
  surface: '#0c1220',
  surface2: '#111a2e',
  border: '#1d283e',
  borderSubtle: '#162033',
  text: '#e7edf7',
  muted: '#8292ab',

  // Semantic Entity & Node Colors
  target: {
    bg: '#06b6d4',          // Cyan-500
    border: '#22d3ee',      // Cyan-400
    text: '#67e8f9',        // Cyan-300
    shadow: '#06b6d4',
  },
  direct: {
    bg: '#059669',          // Emerald-600
    border: '#10b981',      // Emerald-500
    text: '#a7f3d0',        // Emerald-200
    shadow: '#10b981',
  },
  intermediary: {
    bg: '#7c3aed',          // Violet-600
    border: '#a78bfa',      // Violet-400
    text: '#ede9fe',        // Violet-100
    shadow: '#8b5cf6',
  },
  vasp: {
    bg: '#d97706',          // Amber-600
    border: '#fbbf24',      // Amber-400
    text: '#fef3c7',        // Amber-100
    shadow: '#f59e0b',
  },
  danger: {
    bg: '#e11d48',          // Rose-600
    border: '#fb7185',      // Rose-400
    text: '#ffe4e6',        // Rose-100
    shadow: '#f43f5e',
  },

  // Edge / Relationship Transfer Colors
  edges: {
    base: '#1e2b45',
    baseArrow: '#41516c',
    direct: '#059669',
    directArrow: '#10b981',
    intermediary: '#6d28d9',
    intermediaryArrow: '#8b5cf6',
    vasp: '#d97706',
    vaspArrow: '#fbbf24',
    danger: '#e11d48',
    dangerArrow: '#fb7185',
    selected: '#06b6d4',
    flow: '#22d3ee',
  },
};

export default FORENSIC_THEME;
