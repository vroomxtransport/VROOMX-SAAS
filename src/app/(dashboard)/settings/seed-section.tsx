'use client'

import { useState } from 'react'
import { seedSampleData, clearSampleData } from '@/app/actions/onboarding'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Database, Trash2, Loader2 } from 'lucide-react'

interface SeedSectionProps {
  isOwner: boolean
}

export function SeedSection({ isOwner }: SeedSectionProps) {
  const [seeding, setSeeding] = useState(false)
  const [clearing, setClearing] = useState(false)

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Sample Data
        </CardTitle>
        <CardDescription>
          Load realistic demo data to explore VroomX features. Includes brokers, drivers, trucks, orders, and trips.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Button
            onClick={handleSeed}
            disabled={seeding || clearing}
          >
            {seeding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load Sample Data'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleClear}
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
  )
}
