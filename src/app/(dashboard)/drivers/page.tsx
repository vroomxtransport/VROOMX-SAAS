import { Suspense } from 'react'
import { DriverList } from './_components/driver-list'

export const metadata = {
  title: 'Drivers | VroomX',
}

export default function DriversPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your fleet drivers, pay configuration, and status.
        </p>
      </div>
      <Suspense fallback={null}>
        <DriverList />
      </Suspense>
    </div>
  )
}
