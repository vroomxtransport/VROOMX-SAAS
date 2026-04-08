interface BrandStyleProps {
  primary: string | null
  secondary: string | null
}

const DEFAULT_PRIMARY = '#192334'
const DEFAULT_SECONDARY = '#fb7232'
const HEX_RE = /^#[0-9a-fA-F]{6}$/

/**
 * Server-rendered <style> block that exposes the carrier's brand colors as
 * CSS variables to the entire public application surface.
 *
 * Defense-in-depth: re-validates the hex format even though brandingSchema
 * (src/lib/validations/tenant-settings.ts) already validates on write. The
 * public read path bypasses Zod, and we are interpolating tenant-controlled
 * data into HTML inside <style>. The regex prevents CSS injection if the
 * column is ever populated by a path that bypasses updateBranding().
 *
 * Children consume via Tailwind arbitrary values:
 *   bg-[var(--brand-primary,#192334)]
 *   focus-visible:ring-[var(--brand-secondary,#fb7232)]
 *
 * Or via inline style:
 *   style={{ background: 'var(--brand-primary, #192334)' }}
 */
export function BrandStyle({ primary, secondary }: BrandStyleProps) {
  const p = primary && HEX_RE.test(primary) ? primary : DEFAULT_PRIMARY
  const s = secondary && HEX_RE.test(secondary) ? secondary : DEFAULT_SECONDARY
  return (
    <style>{`:root{--brand-primary:${p};--brand-secondary:${s};}`}</style>
  )
}
