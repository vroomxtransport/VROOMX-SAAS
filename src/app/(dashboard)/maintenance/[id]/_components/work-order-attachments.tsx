import { Paperclip } from 'lucide-react'

export function WorkOrderAttachments() {
  return (
    <div className="widget-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Attachments</h2>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
        <div className="rounded-xl bg-muted p-3">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">File attachments coming soon</p>
        <p className="text-xs text-muted-foreground max-w-[220px]">
          Photo and document uploads will be available in the next update.
        </p>
      </div>
    </div>
  )
}
