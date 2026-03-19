'use server'

import { authorize, safeError } from '@/lib/authz'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function markChannelRead(channelId: string) {
  if (!UUID_RE.test(channelId)) return { error: 'Invalid channel ID' }

  const auth = await authorize('chat.read')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { error } = await supabase
    .from('chat_channel_reads')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        channel_id: channelId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,channel_id' }
    )

  if (error) return { error: safeError(error, 'markChannelRead') }
  return { success: true }
}
