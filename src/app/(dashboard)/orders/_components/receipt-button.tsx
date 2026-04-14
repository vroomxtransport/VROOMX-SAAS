'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import type { PaymentStatus, PaymentType } from '@/types'
import { Button } from '@/components/ui/button'
import { ReceiptDialog } from './receipt-dialog'

interface ReceiptButtonProps {
  orderId: string
  orderNumber: string | null
  paymentType: PaymentType | null
  paymentStatus: PaymentStatus
  pickupContact: { name: string | null; email: string | null }
  deliveryContact: { name: string | null; email: string | null }
  broker: { name: string | null; email: string | null } | null
}

/**
 * "Send Payment Receipt" button. Only renders for non-BILL orders — BILL
 * orders use the invoice-send flow. The server also enforces this guard
 * (409 on BILL) so this predicate is a UX nicety, not a security control.
 */
export function ReceiptButton({
  orderId,
  orderNumber,
  paymentType,
  paymentStatus,
  pickupContact,
  deliveryContact,
  broker,
}: ReceiptButtonProps) {
  const [open, setOpen] = useState(false)

  if (paymentType === 'BILL') return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Receipt className="mr-2 h-4 w-4" />
        Send Receipt
      </Button>
      <ReceiptDialog
        orderId={orderId}
        orderNumber={orderNumber}
        paymentStatus={paymentStatus}
        pickupContact={pickupContact}
        deliveryContact={deliveryContact}
        broker={broker}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
