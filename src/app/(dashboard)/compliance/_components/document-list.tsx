'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useComplianceDocs } from '@/hooks/use-compliance'
import { deleteComplianceDoc } from '@/app/actions/compliance'
import { DocumentCard } from './document-card'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { COMPLIANCE_ENTITY_TYPE_LABELS } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { fetchComplianceDocs } from '@/lib/queries/compliance'
import type { ComplianceDocument } from '@/types/database'
import type { EnhancedFilterConfig, DateRange, SortConfig } from '@/types/filters'

const PAGE_SIZE = 12

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'q',
    label: 'Search',
    type: 'search',
    placeholder: 'Search documents...',
  },
  {
    key: 'entityType',
    label: 'Entity Type',
    type: 'select',
    options: Object.entries(COMPLIANCE_ENTITY_TYPE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    key: 'expiryRange',
    label: 'Expiry Date',
    type: 'date-range',
  },
]

interface DocumentListProps {
  documentType: string
  onEdit: (doc: ComplianceDocument) => void
  onAdd: () => void
}

export function DocumentList({ documentType, onEdit, onAdd }: DocumentListProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse URL search params
  const search = searchParams.get('q') ?? undefined
  const entityType = searchParams.get('entityType') ?? undefined
  const expiryFrom = searchParams.get('expiryFrom') ?? undefined
  const expiryTo = searchParams.get('expiryTo') ?? undefined
  const sortBy = searchParams.get('sortBy') ?? undefined
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const sort: SortConfig | undefined = sortBy
    ? { field: sortBy, direction: sortDir ?? 'asc' }
    : undefined

  const { data, isLoading } = useComplianceDocs({
    documentType,
    entityType,
    search,
    expiryFrom,
    expiryTo,
    sortBy,
    sortDir,
    page,
    pageSize: PAGE_SIZE,
  })

  // Build activeFilters for EnhancedFilterBar
  const activeFilters: Record<string, string | string[] | DateRange | undefined> = {}
  if (search) activeFilters.q = search
  if (entityType) activeFilters.entityType = entityType
  if (expiryFrom && expiryTo) {
    activeFilters.expiryRange = { from: expiryFrom, to: expiryTo }
  }

  const setFilter = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())

      if (key === 'expiryRange') {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const dr = value as DateRange
          params.set('expiryFrom', dr.from)
          params.set('expiryTo', dr.to)
        } else {
          params.delete('expiryFrom')
          params.delete('expiryTo')
        }
      } else if (typeof value === 'string' && value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }

      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handleSort = useCallback(
    (newSort: SortConfig | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newSort) {
        params.set('sortBy', newSort.field)
        params.set('sortDir', newSort.direction)
      } else {
        params.delete('sortBy')
        params.delete('sortDir')
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(newPage))
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handleDelete = async (id: string) => {
    await deleteComplianceDoc(id)
    queryClient.invalidateQueries({ queryKey: ['compliance-docs'] })
    queryClient.invalidateQueries({ queryKey: ['compliance-expiration-alerts'] })
  }

  // CSV export: fetch all matching documents (no pagination)
  const handleCsvExport = useCallback(async () => {
    const supabase = createClient()
    const result = await fetchComplianceDocs(supabase, {
      documentType,
      entityType,
      search,
      expiryFrom,
      expiryTo,
      sortBy,
      sortDir,
      page: 0,
      pageSize: 5000,
    })

    return result.docs.map((doc) => ({
      name: doc.name,
      document_type: doc.document_type,
      entity_type: doc.entity_type,
      expires_at: doc.expires_at
        ? new Date(doc.expires_at).toLocaleDateString()
        : 'No expiry',
      file_name: doc.file_name ?? '',
      created_at: doc.created_at
        ? new Date(doc.created_at).toLocaleDateString()
        : '',
    }))
  }, [documentType, entityType, search, expiryFrom, expiryTo, sortBy, sortDir])

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
      {/* Filter bar + CSV export */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <EnhancedFilterBar
              filters={FILTER_CONFIG}
              activeFilters={activeFilters}
              onFilterChange={setFilter}
              resultCount={total}
            />
          </div>
          <CsvExportButton
            filename="compliance-documents"
            headers={['name', 'document_type', 'entity_type', 'expires_at', 'file_name', 'created_at']}
            fetchData={handleCsvExport}
          />
        </div>
      </div>

      {/* Sort controls */}
      <div className="mb-3 flex items-center gap-4 px-1">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        <SortHeader
          label="Expiry Date"
          field="expiry_date"
          currentSort={sort}
          onSort={handleSort}
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
