import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatLayout } from './_components/chat-layout'

export const metadata = { title: 'Team Chat | VroomX' }

export default async function TeamChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login')

  return <ChatLayout tenantId={tenantId} />
}
