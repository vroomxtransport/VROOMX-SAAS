import Image from 'next/image'

interface TenantHeaderProps {
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  logoStoragePath: string | null
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
  logoStoragePath,
}: TenantHeaderProps) {
  // Build logo public URL if path exists
  let logoUrl: string | null = null
  if (logoStoragePath) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      logoUrl = `${supabaseUrl}/storage/v1/object/public/documents/${logoStoragePath}`
    }
  }

  const addressLine = [address, city, state ? `${state}${zip ? ` ${zip}` : ''}` : zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex items-center gap-4 py-3 px-0">
      {logoUrl && (
        <div className="shrink-0">
          <Image
            src={logoUrl}
            alt={`${name} logo`}
            width={56}
            height={56}
            className="h-14 w-14 rounded object-contain bg-white p-1"
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
