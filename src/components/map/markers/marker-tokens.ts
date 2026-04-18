/**
 * Trip route map — design tokens shared across pickup/delivery pins,
 * polylines, and chrome. Single source of truth keeps marker SVGs and
 * the CSS in `globals.css` from drifting apart.
 *
 * These mirror the CSS custom properties declared under `:root` in
 * `src/app/globals.css` (the `--marker-*` block). Update both together.
 */

export const MARKER_TOKENS = {
  pickup: {
    fill: '#ffffff',
    stroke: '#192334', // navy
    badgeBg: '#192334',
    badgeText: '#ffffff',
    glyph: '▲',
  },
  delivery: {
    fill: '#fb7232', // brand orange
    stroke: '#c4521f', // darker orange
    badgeBg: '#ffffff',
    badgeText: '#fb7232',
    glyph: '■',
  },
  vehicleCount: {
    bg: '#192334',
    text: '#ffffff',
    stroke: '#ffffff',
  },
  failed: {
    fill: 'transparent',
    stroke: '#c2410c',
    badgeBg: '#fef7ed',
    badgeText: '#c2410c',
  },
  // States — applied to the whole pin via CSS class
  states: {
    default: '',
    hover: 'vroomx-marker--hover',
    active: 'vroomx-marker--active',
  },
} as const

export type MarkerKind = 'pickup' | 'delivery'
export type MarkerState = keyof typeof MARKER_TOKENS.states
