import { MorphingSquare } from '@/components/ui/morphing-square'

export default function AuthLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <MorphingSquare message="Loading..." />
    </div>
  )
}
