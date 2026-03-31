import { Suspense } from 'react'
import { TerminalList } from './_components/terminal-list'

export const metadata = {
  title: 'Terminals | Settings | VroomX',
}

export default function TerminalsSettingsPage() {
  return (
    <Suspense fallback={null}>
      <TerminalList />
    </Suspense>
  )
}
