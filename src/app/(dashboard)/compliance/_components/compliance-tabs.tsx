'use client'

import { useState } from 'react'
import { ExpirationAlerts } from './expiration-alerts'
import { DocumentList } from './document-list'
import { UploadDrawer } from './upload-drawer'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComplianceDocument } from '@/types/database'

const TABS = [
  { key: 'dqf', label: 'Driver Qualification' },
  { key: 'vehicle_qualification', label: 'Vehicle Qualification' },
  { key: 'company_document', label: 'Company Documents' },
] as const

export function ComplianceTabs() {
  const [activeTab, setActiveTab] = useState<string>('dqf')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | undefined>(undefined)

  const handleAdd = () => {
    setEditingDoc(undefined)
    setDrawerOpen(true)
  }

  const handleEdit = (doc: ComplianceDocument) => {
    setEditingDoc(doc)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-4">
      <ExpirationAlerts />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <DocumentList
        key={activeTab}
        documentType={activeTab}
        onEdit={handleEdit}
        onAdd={handleAdd}
      />

      <UploadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        doc={editingDoc}
      />
    </div>
  )
}
