'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
