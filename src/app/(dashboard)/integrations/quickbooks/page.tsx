import { getQuickBooksStatus } from '@/app/actions/quickbooks'
import { QuickBooksDashboard } from './_components/quickbooks-dashboard'

export const metadata = {
  title: 'QuickBooks Online | VroomX',
  description: 'Sync invoices, payments, customers, and expenses with QuickBooks Online.',
}

export default async function QuickBooksPage() {
  const statusResult = await getQuickBooksStatus()

  const initialStatus =
    'success' in statusResult && statusResult.success ? statusResult.data : null

  return <QuickBooksDashboard initialStatus={initialStatus} />
}
