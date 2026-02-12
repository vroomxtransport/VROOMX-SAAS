import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Upload a file to a tenant-scoped path in Supabase Storage.
 *
 * Path format: {tenantId}/{entityId}/{randomUUID}.{ext}
 */
export async function uploadFile(
  supabase: SupabaseClient,
  bucket: string,
  tenantId: string,
  entityId: string,
  file: File,
): Promise<{ path: string; error: string | null }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const fileName = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${tenantId}/${entityId}/${fileName}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) return { path: '', error: error.message }
  return { path: storagePath, error: null }
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([storagePath])
  if (error) return { error: error.message }
  return { error: null }
}

/**
 * Get the public URL for a file in Supabase Storage.
 */
export function getFileUrl(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath)
  return data.publicUrl
}

/**
 * Get a time-limited signed URL for a file in Supabase Storage.
 * Default expiration: 1 hour (3600 seconds).
 */
export async function getSignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
  expiresIn: number = 3600,
): Promise<{ url: string; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn)

  return {
    url: data?.signedUrl ?? '',
    error: error?.message ?? null,
  }
}
