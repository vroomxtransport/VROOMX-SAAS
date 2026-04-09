'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i)
  }

  const pages: (number | 'ellipsis')[] = [0]

  if (currentPage > 2) {
    pages.push('ellipsis')
  }

  const start = Math.max(1, currentPage - 1)
  const end = Math.min(totalPages - 2, currentPage + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (currentPage < totalPages - 3) {
    pages.push('ellipsis')
  }

  pages.push(totalPages - 1)

  return pages
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, total)
  const isFirstPage = page === 0
  const isLastPage = page >= totalPages - 1

  if (total === 0) {
    return null
  }

  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="flex items-center justify-between border-t border-border-subtle px-1 py-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirstPage}
          className="h-8"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-1" />
          Previous
        </Button>

        {/* Page numbers — hidden on mobile */}
        {totalPages > 1 && pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="hidden px-1 text-sm text-muted-foreground md:inline">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(p)}
              className={cn(
                'hidden h-8 w-8 p-0 md:inline-flex',
                p === page && 'pointer-events-none'
              )}
            >
              {p + 1}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={isLastPage}
          className="h-8"
        >
          Next
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-1" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector — hidden on mobile */}
        {onPageSizeChange && (
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{start}</span>–<span className="font-medium text-foreground">{end}</span> of{' '}
          <span className="font-medium text-foreground">{total}</span>
        </p>
      </div>
    </div>
  )
}
