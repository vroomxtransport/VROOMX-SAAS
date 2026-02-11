import { Suspense } from 'react'
import { TruckList } from './_components/truck-list'

export const metadata = {
  title: 'Fleet | VroomX',
}

export default function TrucksPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fleet</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your trucks and fleet vehicles
        </p>
      </div>
      <Suspense fallback={null}>
        <TruckList />
      </Suspense>
    </div>
  )
}
