'use client'

import { useState } from 'react'
import { seedSampleData, clearSampleData } from '@/app/actions/onboarding'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { toast } from 'sonner'
import { Database, Trash2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

interface SeedSectionProps {
  isOwner: boolean
}

const SAMPLE_DATA_ITEMS = [
  '3 sample brokers',
  '2 sample drivers with pay configuration',
  '2 sample trucks',
  '5 sample orders with routes',
  '2 sample trips',
] as const

export function SeedSection({ isOwner }: SeedSectionProps) {
  const [seeding, setSeeding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!isOwner) return null

  async function handleSeed() {
    setSeeding(true)
    try {
      const result = await seedSampleData()
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Sample data loaded! Check your brokers, drivers, trucks, and orders.')
      }
    } catch {
      toast.error('Failed to load sample data')
    } finally {
      setSeeding(false)
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      const result = await clearSampleData()
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Sample data cleared successfully.')
      }
    } catch {
      toast.error('Failed to clear sample data')
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear sample data?"
        description="This will permanently remove all sample data. Your real data will not be affected."
        confirmLabel="Clear Sample Data"
        destructive
        onConfirm={handleClear}
      />

      <div className="space-y-4">
        {/* Load sample data sub-card */}
        <Card className="widget-card !p-0 border-0 shadow-none">
          <CardHeader className="pb-4 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Load Sample Data</CardTitle>
                <CardDescription className="text-sm">
                  Populate your account with realistic demo data to explore VroomX features
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            <ul className="space-y-2">
              {SAMPLE_DATA_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex justify-end">
              <Button onClick={handleSeed} disabled={seeding || clearing}>
                {seeding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Load Sample Data
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clear sample data sub-card */}
        <Card className="widget-card !p-0 border border-destructive/30 bg-destructive/5 shadow-none">
          <CardHeader className="pb-4 border-b border-destructive/20">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-destructive">
                  Clear Sample Data
                </CardTitle>
                <CardDescription className="text-sm">
                  Remove all sample data from your account
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive/80">
                This will permanently remove all sample data. Your real data will not be affected.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={seeding || clearing}
              >
                {clearing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Sample Data
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
