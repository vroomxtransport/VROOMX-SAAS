const fleetBadges = [
  { size: '1 truck', name: 'Owner-Operator' },
  { size: '3 trucks', name: 'Solo Operator' },
  { size: '8 trucks', name: 'Regional Fleet' },
  { size: '15 trucks', name: 'Growing Carrier' },
  { size: '25 trucks', name: 'Mid-Size Fleet' },
  { size: '45 trucks', name: 'Large Carrier' },
]

export function LogoStrip() {
  return (
    <section className="border-y border-border-subtle bg-surface-raised py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-muted-foreground">
          Built for owner-operators and growing carriers
        </p>
        <div className="mt-6 overflow-hidden marquee-fade-mask">
          <div className="flex w-max animate-marquee gap-x-4">
            {[...fleetBadges, ...fleetBadges].map((badge, i) => (
              <div
                key={`${badge.name}-${i}`}
                className="flex flex-col items-center rounded-xl border border-border-subtle bg-surface px-5 py-2.5 shadow-sm"
              >
                <span className="text-sm font-bold text-foreground">
                  {badge.size}
                </span>
                <span className="text-xs text-muted-foreground">
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
