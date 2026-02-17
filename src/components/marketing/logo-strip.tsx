const carriers = [
  'APEX AUTO',
  'NATIONWIDE CARRIERS',
  'EAGLE TRANSPORT',
  'VELOCITY HAUL',
  'COAST LOGISTICS',
  'SUMMIT FREIGHT',
  'TITAN MOTORS',
  'PACIFIC ROUTE',
  'LIBERTY HAUL',
  'PRIME FLEET',
]

export function LogoStrip() {
  return (
    <section className="border-y border-border-subtle bg-surface-raised py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-muted-foreground">
          Trusted by carriers hauling 10,000+ vehicles per month
        </p>
        <div className="overflow-hidden marquee-fade-mask mt-6">
          <div className="flex animate-marquee w-max gap-x-12">
            {[...carriers, ...carriers].map((name, i) => (
              <span key={`${name}-${i}`} className="flex items-center gap-0">
                <span className="text-lg font-bold uppercase tracking-[0.25em] text-muted-foreground/30 whitespace-nowrap select-none">
                  {name}
                </span>
                <span className="text-muted-foreground/15 mx-2">&#9670;</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
