'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Copy, FileText, Mail } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { duplicateWorkOrder } from '@/app/actions/work-orders'
import { WorkOrderSendDialog } from './work-order-send-dialog'
import type { WorkOrderDetail } from '@/lib/queries/work-orders'

interface WorkOrderActionsMenuProps {
  wo: WorkOrderDetail
}

export function WorkOrderActionsMenu({ wo }: WorkOrderActionsMenuProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  const handleDuplicate = () => {
    setOpen(false)
    startTransition(async () => {
      const result = await duplicateWorkOrder({ id: wo.id })
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to duplicate work order.'
        toast.error(msg)
        return
      }

      toast.success(`Work order duplicated`)
      if ('workOrderId' in result && typeof result.workOrderId === 'string') {
        router.push(`/maintenance/${result.workOrderId}`)
      }
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={isPending}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Work order actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href={`/api/work-orders/${wo.id}/pdf`} download>
            <FileText className="mr-2 h-4 w-4" />
            Download PDF
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            setOpen(false)
            setSendOpen(true)
          }}
        >
          <Mail className="mr-2 h-4 w-4" />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>

      <WorkOrderSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        workOrderId={wo.id}
        woNumber={wo.wo_number}
        defaultRecipient={wo.shop?.email ?? null}
      />
    </DropdownMenu>
  )
}
