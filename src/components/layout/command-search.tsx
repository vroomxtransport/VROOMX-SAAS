'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  PackageSearchIcon,
  TruckIcon,
  UserSettings01Icon,
  Route01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { globalSearch, type SearchResult, type SearchResults } from '@/app/actions/search'

type Category = 'all' | 'orders' | 'drivers' | 'trucks' | 'trips'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HugeIcon = any // Hugeicons icon data (array of SVG paths)

const CATEGORIES: { value: Category; label: string; icon: HugeIcon }[] = [
  { value: 'all', label: 'All', icon: Search01Icon },
  { value: 'orders', label: 'Orders', icon: PackageSearchIcon },
  { value: 'drivers', label: 'Drivers', icon: UserSettings01Icon },
  { value: 'trucks', label: 'Trucks', icon: TruckIcon },
  { value: 'trips', label: 'Trips', icon: Route01Icon },
]

const CATEGORY_ICONS: Record<string, HugeIcon> = {
  orders: PackageSearchIcon,
  drivers: UserSettings01Icon,
  trucks: TruckIcon,
  trips: Route01Icon,
}

export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Cmd+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery('')
      setCategory('all')
      setResults(null)
      setSelectedIndex(0)
    }
  }

  // Debounced search
  const triggerSearch = useCallback(
    (q: string, cat: Category) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (q.length < 2) {
        setResults(null)
        setLoading(false)
        return
      }

      setLoading(true)
      debounceRef.current = setTimeout(async () => {
        const res = await globalSearch({ query: q, category: cat })
        if ('data' in res && res.data) {
          setResults(res.data)
        } else {
          setResults(null)
        }
        setLoading(false)
        setSelectedIndex(0)
      }, 300)
    },
    []
  )

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery)
    triggerSearch(nextQuery, category)
  }

  function handleCategoryChange(nextCategory: Category) {
    setCategory(nextCategory)
    triggerSearch(query, nextCategory)
  }

  // Flatten results for keyboard nav
  const allResults: SearchResult[] = results
    ? [...results.orders, ...results.drivers, ...results.trucks, ...results.trips]
    : []

  const totalCount = allResults.length

  function handleNavigate(result: SearchResult) {
    setOpen(false)
    router.push(result.href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(totalCount, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + Math.max(totalCount, 1)) % Math.max(totalCount, 1))
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault()
      handleNavigate(allResults[selectedIndex])
    }
  }

  const hasResults = results && totalCount > 0
  const hasQuery = query.length >= 2

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 w-full max-w-sm rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-brand/30 hover:bg-accent/50 transition-all"
      >
        <HugeiconsIcon icon={Search01Icon} size={14} className="text-muted-foreground/60" />
        <span className="flex-1 text-left text-muted-foreground/60">Search...</span>
        <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>

          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            {loading ? (
              <HugeiconsIcon icon={Loading03Icon} size={16} className="text-brand shrink-0 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Search01Icon} size={16} className="text-brand shrink-0" />
            )}
            <Input
              placeholder="Search orders, trucks, drivers..."
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
              autoFocus
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Category filters */}
          <div className="flex gap-1 px-4 pt-3 pb-2 border-b">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  category === cat.value
                    ? 'bg-brand/10 text-brand border border-brand/30'
                    : 'text-muted-foreground hover:bg-accent border border-transparent'
                }`}
              >
                <HugeiconsIcon icon={cat.icon} size={12} />
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results area */}
          <div className="max-h-[320px] overflow-y-auto">
            {!hasQuery && (
              <div className="p-6 text-center">
                <p className="text-xs text-muted-foreground/60">
                  Start typing to search across all categories
                </p>
              </div>
            )}

            {hasQuery && loading && (
              <div className="p-6 text-center">
                <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Searching...</p>
              </div>
            )}

            {hasQuery && !loading && !hasResults && (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try a different search term or category
                </p>
              </div>
            )}

            {hasResults && !loading && (
              <div className="py-2">
                {(['orders', 'drivers', 'trucks', 'trips'] as const).map((cat) => {
                  const items = results[cat]
                  if (items.length === 0) return null
                  const catIcon = CATEGORY_ICONS[cat]

                  return (
                    <div key={cat}>
                      <div className="px-4 py-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <HugeiconsIcon icon={catIcon} size={12} />
                          {cat}
                        </p>
                      </div>
                      {items.map((result) => {
                        const flatIndex = allResults.findIndex((r) => r.id === result.id)
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleNavigate(result)}
                            className={`w-full flex items-start gap-3 px-4 py-2 text-left transition-colors ${
                              flatIndex === selectedIndex
                                ? 'bg-accent text-foreground'
                                : 'text-foreground hover:bg-accent/50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{result.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
