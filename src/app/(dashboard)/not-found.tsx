import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[400px] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          404
        </h1>
        <h2 className="mt-3 text-lg font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This dashboard page doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-5">
          <Button asChild size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
