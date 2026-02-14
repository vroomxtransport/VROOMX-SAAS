import { cn } from '@/lib/utils'

interface BrowserFrameProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function BrowserFrame({ children, className, style }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[#2e2e2d] bg-[#1a1a19] p-1',
        className
      )}
      style={style}
    >
      {/* Chrome bar */}
      <div className="flex h-8 items-center gap-1.5 rounded-t-xl bg-[#141413] px-4">
        <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
      </div>
      {/* Content */}
      <div className="overflow-hidden rounded-b-xl">{children}</div>
    </div>
  )
}
