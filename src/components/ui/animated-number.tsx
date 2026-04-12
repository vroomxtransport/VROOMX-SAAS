'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface AnimatedNumberProps {
  /** Target numeric value to display. */
  value: number
  /**
   * `Intl.NumberFormat` options. Defaults to `{ useGrouping: true }`.
   * Pass `minimumFractionDigits`/`maximumFractionDigits` for decimals.
   */
  format?: Intl.NumberFormatOptions
  /** BCP-47 locale. Defaults to `en-US`. */
  locale?: string
  /** Animation duration in milliseconds. Defaults to 1000. */
  duration?: number
  /**
   * Whether the count-up animation should play.
   * - `undefined` (default) or `true`: animate from 0 to `value` on first
   *   transition to `true`, and from current value to new value on subsequent
   *   `value` changes.
   * - `false`: render the value statically with no animation.
   *
   * Typical pattern: wire to `useInView` from `motion/react` so the tween
   * only runs once the element scrolls into view.
   */
  trigger?: boolean
  className?: string
}

const DEFAULT_FORMAT: Intl.NumberFormatOptions = { useGrouping: true }

/**
 * Pure formatter — safe to import in tests without a DOM.
 * Exported for unit tests.
 */
export function formatValue(
  value: number,
  format: Intl.NumberFormatOptions = DEFAULT_FORMAT,
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, format).format(value)
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * In-house animated number component. Pure React + `requestAnimationFrame`
 * + `Intl.NumberFormat`. No Web Components, no custom element registration,
 * no SSR fallback that can leak onto the page.
 *
 * SSR-safe: the server (and the initial client render pre-hydration) renders
 * the final formatted value as plain text, so if JS never loads the user
 * still sees the correct number. The animation starts in an effect after
 * mount.
 *
 * This component intentionally replaces `@number-flow/react` — see
 * `.claude/rules/frontend/ui-library-choice.md` for the rationale.
 */
export function AnimatedNumber({
  value,
  format,
  locale = 'en-US',
  duration = 1000,
  trigger,
  className,
}: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState<number>(value)
  const hasAnimatedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  // Tracks the value most recently written to `displayed` so a subsequent
  // tween (triggered by a `value` change) can start from the current on-screen
  // number. Mutated only inside effects / the rAF step — never during render.
  const displayedRef = useRef<number>(value)

  useEffect(() => {
    const cleanup = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const shouldAnimate = trigger ?? true
    const wantsStatic =
      !shouldAnimate || prefersReducedMotion() || duration <= 0

    // STATIC PATH — no tween needed. If the currently displayed value already
    // matches `value`, the effect is a no-op (common case: initial mount with
    // `trigger={false}`, since state is initialised to `value`). Otherwise
    // schedule a one-shot rAF to snap to the new value — this keeps the
    // setState call off the effect body and satisfies
    // react-hooks/set-state-in-effect.
    if (wantsStatic) {
      // Always return `cleanup` even on the no-op path: a prior in-flight rAF
      // from a previous effect run may still be pending (e.g. value oscillates
      // 47 → 50 → 47 inside a single rAF frame), and we need React to cancel
      // it on unmount / next effect run to avoid a stale `setDisplayed(50)`
      // landing after the value has already snapped back to 47.
      if (displayedRef.current === value) return cleanup
      rafRef.current = requestAnimationFrame(() => {
        displayedRef.current = value
        setDisplayed(value)
        if (duration <= 0 && shouldAnimate) hasAnimatedRef.current = true
        rafRef.current = null
      })
      return cleanup
    }

    // ANIMATION PATH
    const start = hasAnimatedRef.current ? displayedRef.current : 0
    const end = value

    if (start === end) {
      // Already at target; nothing to tween. Ensure ref is canonical.
      if (displayedRef.current !== end) {
        rafRef.current = requestAnimationFrame(() => {
          displayedRef.current = end
          setDisplayed(end)
          rafRef.current = null
        })
        return cleanup
      }
      return
    }

    hasAnimatedRef.current = true
    let startTime: number | null = null

    const step = (now: number) => {
      if (startTime === null) startTime = now
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const next = start + (end - start) * eased
      displayedRef.current = next
      setDisplayed(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return cleanup
  }, [value, trigger, duration])

  const memoFormat = useMemo(() => format ?? DEFAULT_FORMAT, [format])

  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', display: 'inline-block' }}
    >
      {formatValue(displayed, memoFormat, locale)}
    </span>
  )
}
