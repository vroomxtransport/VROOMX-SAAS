'use client'

import { useState, useEffect } from 'react'
import { Search, PackageSearch, Truck, UserCog, Route } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const SEARCH_CATEGORIES = [
  { label: 'Orders', icon: PackageSearch, shortcut: 'O' },
  { label: 'Trucks', icon: Truck, shortcut: 'T' },
  { label: 'Drivers', icon: UserCog, shortcut: 'D' },
  { label: 'Trips', icon: Route, shortcut: 'R' },
]

export function CommandSearch() {
  const [open, setOpen] = useState(false)

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 w-full max-w-sm rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-brand/30 hover:bg-accent/50 transition-all"
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="flex-1 text-left text-muted-foreground/60">Search...</span>
        <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-brand shrink-0" />
            <Input
              placeholder="Search orders, trucks, drivers..."
              className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
              autoFocus
            />
          </div>
          <div className="p-6">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Browse by category</p>
            <div className="flex flex-wrap gap-2">
              {SEARCH_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon
                return (
                  <button
                    key={cat.label}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-brand/40 hover:bg-accent transition-all"
                  >
                    <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {cat.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground/60">
              Start typing to search across all categories
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
