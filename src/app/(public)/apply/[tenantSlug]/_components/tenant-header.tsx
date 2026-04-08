import Image from 'next/image'

interface TenantHeaderProps {
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  /**
   * Pre-resolved signed URL for the carrier's logo, or null if no logo.
   * Computed server-side via publicReadTenantLogoUrl() — never construct
   * storage URLs in this component.
   */
  logoUrl: string | null
}

/**
 * Server-rendered header card matching the reference screenshots:
 * Logo (if present) | CARRIER NAME IN BOLD CAPS | address on line below
 *
 * Appears at the top of every wizard page.
 */
export function TenantHeader({
  name,
  address,
  city,
  state,
  zip,
  logoUrl,
}: TenantHeaderProps) {
  const addressLine = [address, city, state ? `${state}${zip ? ` ${zip}` : ''}` : zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex items-center gap-4 py-3 px-0">
      {logoUrl && (
        <div className="shrink-0">
          {/*
            unoptimized is LOAD-BEARING for security and correctness — do not remove.
            Without it, Next.js proxies through /_next/image which (a) caches the
            signed-URL bytes past their 1h expiry on the CDN, and (b) can leak
            cached tenant logos across tenants on a shared CDN tier. With it, the
            browser fetches the signed URL directly and the signature is honored.
          */}
          <Image
            src={logoUrl}
            alt={`${name} logo`}
            width={56}
            height={56}
            className="h-14 w-14 rounded object-contain bg-white p-1"
            unoptimized
          />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-sm font-bold uppercase tracking-widest text-white leading-tight truncate">
          {name}
        </h1>
        {addressLine && (
          <p className="mt-0.5 text-xs text-white/50 truncate">
            {addressLine}
          </p>
        )}
      </div>
    </div>
  )
}
