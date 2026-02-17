'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PaymentStatus } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Send, Download, FileText, Loader2 } from 'lucide-react'

interface InvoiceButtonProps {
  orderId: string
  orderNumber: string | null
  paymentStatus: PaymentStatus
  invoiceDate: string | null
  hasBrokerEmail: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function InvoiceButton({
  orderId,
  orderNumber,
  paymentStatus,
  invoiceDate,
  hasBrokerEmail,
}: InvoiceButtonProps) {
  const queryClient = useQueryClient()
  const [isSending, setIsSending] = useState(false)

  const isAlreadyInvoiced =
    paymentStatus === 'invoiced' ||
    paymentStatus === 'partially_paid' ||
    paymentStatus === 'paid'

  const handleSendInvoice = async () => {
    setIsSending(true)
    try {
      const response = await fetch(`/api/invoices/${orderId}/send`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send invoice')
      }

      toast.success('Invoice sent to broker')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send invoice'
      )
    } finally {
      setIsSending(false)
    }
  }

  const handleDownloadPdf = () => {
    window.open(`/api/invoices/${orderId}/pdf`, '_blank')
  }

  const sendButton = (
    <Button
      size="sm"
      onClick={handleSendInvoice}
      disabled={!hasBrokerEmail || isSending}
    >
      {isSending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      {isAlreadyInvoiced ? 'Resend Invoice' : 'Send Invoice'}
    </Button>
  )

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {!hasBrokerEmail ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{sendButton}</TooltipTrigger>
              <TooltipContent>
                <p>Broker email required to send invoice</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          sendButton
        )}

        <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
          <Download className="mr-2 h-4 w-4" />
          PDF
        </Button>
      </div>

      {/* Invoice info line */}
      {invoiceDate && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>
            INV-{orderId.slice(0, 8)} -- Invoiced on {formatDate(invoiceDate)}
          </span>
        </div>
      )}
    </div>
  )
}
