import { MARKER_TOKENS, type MarkerKind, type MarkerState } from './marker-tokens'

interface PinOptions {
  kind: MarkerKind
  /** 1-indexed sequence number shown in the badge. */
  sequence: number
  /** Vehicle count for this stop. Badge in top-right when ≥ 2. */
  vehicleCount?: number
  /** Geocode failed for this address — render dashed amber pin. */
  failed?: boolean
  state?: MarkerState
}

/**
 * Inline SVG markup for a trip route map pin. Returned as a string so
 * Leaflet's `DivIcon` can render it without an extra React tree per
 * marker. Two markers per stop × dozens of stops × realtime
 * re-renders = re-mounting React components is more expensive than
 * stringifying SVG.
 *
 * Geometry: 32×40 SVG. Rounded shield body (top 14px radius, bottom
 * 6px point). Inner 24×24 badge rounded 6px, centered 4px from top.
 * Vehicle-count badge: 14px circle top-right (`+6, -4`).
 *
 * The shape encodes pickup vs delivery (color-blind safe). Color
 * reinforces. Glyph (`▲` / `■`) gives a third visual channel.
 */
export function renderPinSvg(opts: PinOptions): string {
  const { kind, sequence, vehicleCount = 0, failed = false } = opts
  const tokens = failed ? MARKER_TOKENS.failed : MARKER_TOKENS[kind]
  const { fill, stroke, badgeBg, badgeText } = tokens
  const glyph = failed ? '!' : MARKER_TOKENS[kind].glyph
  const showCount = vehicleCount >= 2
  const dasharray = failed ? '3 3' : 'none'

  // Shield body — rounded top, pointed bottom. SVG path is fixed
  // because we want crisp pixel rendering at @1x; CSS scaling handles
  // hover state.
  const body = `
    <path d="M16 0 C7.16 0 0 7.16 0 16 V26 L16 40 L32 26 V16 C32 7.16 24.84 0 16 0 Z"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="1.5"
          stroke-dasharray="${dasharray}" />
  `

  // Inner badge — 24×24 rounded square, sequence number 13px/600.
  // Glyph sits as a small caret/square at the top-left of the badge,
  // 8px size, 50% opacity for understatement.
  const badge = `
    <rect x="4" y="4" width="24" height="24" rx="6" fill="${badgeBg}" />
    <text x="16" y="20"
          text-anchor="middle"
          fill="${badgeText}"
          font-size="13"
          font-weight="600"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          letter-spacing="-0.3"
    >${sequence}</text>
    <text x="9" y="11"
          text-anchor="middle"
          fill="${badgeText}"
          font-size="7"
          opacity="0.55"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    >${glyph}</text>
  `

  // Vehicle-count badge (only for stops carrying multiple vehicles).
  // Sits top-right, with a white halo so it lifts off the body.
  const countBadge = showCount
    ? `
    <circle cx="28" cy="2" r="7"
            fill="${MARKER_TOKENS.vehicleCount.bg}"
            stroke="${MARKER_TOKENS.vehicleCount.stroke}"
            stroke-width="1.5" />
    <text x="28" y="5"
          text-anchor="middle"
          fill="${MARKER_TOKENS.vehicleCount.text}"
          font-size="9"
          font-weight="600"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    >${vehicleCount}</text>
  `
    : ''

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 38 44" width="36" height="44" overflow="visible">
      ${body}
      ${badge}
      ${countBadge}
    </svg>
  `.trim()
}

export function pinClassName(state: MarkerState = 'default'): string {
  // Always include the base class so CSS hover/active selectors can
  // hook regardless of state argument. Leaflet doesn't add classes on
  // hover/active for us, so the parent component flips state via
  // setIcon when interaction handlers fire.
  const stateClass = MARKER_TOKENS.states[state]
  return `vroomx-marker ${stateClass}`.trim()
}
