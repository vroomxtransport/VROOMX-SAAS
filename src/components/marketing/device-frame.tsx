import { cn } from '@/lib/utils'

interface DeviceFrameProps {
  children: React.ReactNode
  className?: string
}

export function DeviceFrame({ children, className }: DeviceFrameProps) {
  return (
    <div
      className={cn(
        'relative rounded-[2.5rem] border-[3px] border-[#2e2e2d] bg-[#1a1a19] p-2 shadow-xl',
        className
      )}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1a1a19]" />

      {/* Screen area */}
      <div className="overflow-hidden rounded-[2rem] bg-black">
        {children}
      </div>

      {/* Bottom bar indicator */}
      <div className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-[#2e2e2d]" />
    </div>
  )
}
