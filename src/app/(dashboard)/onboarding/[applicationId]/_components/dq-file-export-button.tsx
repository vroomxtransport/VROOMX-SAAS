'use client'

import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Download02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

interface Props {
  applicationId: string
}

/**
 * DQ File Export button.
 *
 * PDF generation (§ 391.51 regulatory-order assembly) is a v2 follow-up.
 * This component stubs the action with a toast notification.
 */
export function DqFileExportButton({ applicationId: _applicationId }: Props) {
  function handleExport() {
    toast.info('DQ file PDF export is a v2 follow-up', {
      description:
        'Full DQ file assembly in regulatory order (§ 391.51) will be available in the next release.',
    })
  }

  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
      <HugeiconsIcon icon={Download02Icon} size={13} />
      Download DQ File
    </Button>
  )
}
