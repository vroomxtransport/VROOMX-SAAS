'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { InviteDriverModal } from './invite-driver-modal'

export function InviteDriverButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite Driver
      </Button>
      <InviteDriverModal open={open} onOpenChange={setOpen} />
    </>
  )
}
