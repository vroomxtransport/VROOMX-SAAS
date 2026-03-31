'use client'

import { useState } from 'react'
import { useTerminals } from '@/hooks/use-terminals'
import { deleteTerminal } from '@/app/actions/terminals'
import { TerminalForm } from './terminal-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, MapPin, Warehouse } from 'lucide-react'
import type { Terminal } from '@/types/database'

export function TerminalList() {
  const { data: terminals, isLoading } = useTerminals()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTerminal, setEditingTerminal] = useState<Terminal | undefined>(undefined)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleAdd = () => {
    setEditingTerminal(undefined)
    setDrawerOpen(true)
  }

  const handleEdit = (terminal: Terminal) => {
    setEditingTerminal(terminal)
    setDrawerOpen(true)
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await deleteTerminal(id)
    setDeleting(null)
  }

  const handleFormSuccess = () => {
    setDrawerOpen(false)
    setEditingTerminal(undefined)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Terminals</h3>
            <p className="text-sm text-muted-foreground">Physical hub locations for local pickup/delivery operations</p>
          </div>
          <Skeleton className="h-9 w-[140px]" />
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[80px] rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Terminals</h3>
          <p className="text-sm text-muted-foreground">Physical hub locations for local pickup/delivery operations</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Terminal
        </Button>
      </div>

      {!terminals || terminals.length === 0 ? (
        <div className="widget-card flex flex-col items-center justify-center py-12 text-center">
          <Warehouse className="h-10 w-10 text-muted-foreground mb-3" />
          <h4 className="text-sm font-medium">No terminals configured</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add a terminal to enable hub-and-spoke operations. Local drives will be auto-created when trips arrive at terminal.
          </p>
          <Button className="mt-4" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Terminal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className="widget-card flex items-center gap-4 !p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0">
                <Warehouse className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{terminal.name}</span>
                  <Badge variant={terminal.is_active ? 'default' : 'secondary'} className="text-xs">
                    {terminal.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  {(terminal.city || terminal.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[terminal.city, terminal.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {terminal.auto_create_local_drives && (
                    <span>
                      Auto-create: {terminal.auto_create_states?.length ? terminal.auto_create_states.join(', ') : 'All states'}
                    </span>
                  )}
                  <span>Radius: {terminal.service_radius_miles}mi</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(terminal)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Terminal</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &quot;{terminal.name}&quot;? This will not delete associated local drives.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(terminal.id)}
                        disabled={deleting === terminal.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting === terminal.id ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>{editingTerminal ? 'Edit Terminal' : 'Add Terminal'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <TerminalForm
              terminal={editingTerminal}
              onSuccess={handleFormSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
