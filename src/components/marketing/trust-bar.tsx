export function TrustBar() {
  return (
    <section className="border-y border-white/5 bg-[#111]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/50">
          <span className="font-medium text-white/70">
            200+ carriers across 38 states
          </span>

          <span className="hidden text-white/20 sm:inline">|</span>

          <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-0.5 text-xs text-white/60">
            FMCSA Compliant
          </span>

          <span className="hidden text-white/20 sm:inline">|</span>

          <span>14 days free &middot; No credit card</span>

          <span className="hidden text-white/20 lg:inline">|</span>

          <span className="hidden text-white/40 lg:inline">
            <em>&ldquo;VroomX paid for itself in the first week.&rdquo;</em>
            <span className="ml-1 not-italic text-white/60">
              , Tom O., 30-truck fleet
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
