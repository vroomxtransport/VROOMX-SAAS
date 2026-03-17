import { MorphingSquare } from '@/components/ui/morphing-square'

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <MorphingSquare message="Loading dashboard..." />
    </div>
  )
}
