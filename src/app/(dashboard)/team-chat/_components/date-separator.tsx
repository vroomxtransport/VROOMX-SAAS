import { formatDateSeparator } from './chat-utils'

interface DateSeparatorProps {
  date: string
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 py-4" role="separator">
      <div className="h-px flex-1 bg-border-subtle" />
      <span className="stat-pill text-xs select-none">
        {formatDateSeparator(date)}
      </span>
      <div className="h-px flex-1 bg-border-subtle" />
    </div>
  )
}
