'use client'

import { useState, useCallback } from 'react'
import { useComplianceDocs } from '@/hooks/use-compliance'
import { deleteComplianceDoc } from '@/app/actions/compliance'
import { DocumentCard } from './document-card'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { COMPLIANCE_ENTITY_TYPE_LABELS } from '@/types'
import type { ComplianceDocument } from '@/types/database'

const PAGE_SIZE = 12

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search documents...',
  },
  {
    key: 'entityType',
    label: 'Entity',
    type: 'select',
    options: Object.entries(COMPLIANCE_ENTITY_TYPE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
]

interface DocumentListProps {
  documentType: string
  onEdit: (doc: ComplianceDocument) => void
  onAdd: () => void
}

export function DocumentList({ documentType, onEdit, onAdd }: DocumentListProps) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

  const { data, isLoading } = useComplianceDocs({
    documentType,
    entityType: activeFilters.entityType,
    search: activeFilters.search,
    page,
    pageSize: PAGE_SIZE,
  })

  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      setActiveFilters((prev) => {
        const next = { ...prev }
        if (value) {
          next[key] = value
        } else {
          delete next[key]
        }
        return next
      })
      setPage(0)
    },
    []
  )

  const handleDelete = async (id: string) => {
    await deleteComplianceDoc(id)
    queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
    queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
  }

  if (isLoading) {
    return (
      <div>
        <div className="mb-4">
          <Skeleton className="h-9 w-[200px]" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[130px] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const docs = data?.docs ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4">
        <FilterBar
          filters={FILTER_CONFIG}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
        />
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No documents yet"
          description="Upload compliance documents to keep track of certifications and expiration dates."
          action={{
            label: 'Upload Document',
            onClick: onAdd,
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {docs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onEdit={() => onEdit(doc)}
                onDelete={() => handleDelete(doc.id)}
              />
            ))}
          </div>

          <div className="mt-6">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  )
}
