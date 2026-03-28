import * as React from 'react'
import { cn } from '@/lib/utils'

interface HoverAnimationButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
}

export function HoverAnimationButton({
  children = 'Button',
  className,
  ...props
}: HoverAnimationButtonProps) {
  return (
    <button
      className={cn(
        'hover-anim-btn relative z-0 cursor-pointer overflow-hidden rounded-full border-2 border-solid border-black bg-black px-12 py-3 text-sm font-black uppercase leading-6 text-white transition-colors disabled:cursor-default',
        className
      )}
      {...props}
    >
      <span className="relative block overflow-hidden mix-blend-difference">
        <span className="hover-anim-btn-text relative block">{children}</span>
      </span>
    </button>
  )
}
