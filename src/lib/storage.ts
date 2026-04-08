import { SupabaseClient } from '@supabase/supabase-js'
import { validateFileBuffer } from '@/lib/file-validation'

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt',
])

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats',
  'text/',
]

// M6: explicit allowlist passed to the magic-byte validator. The MIME
// prefixes above are for the user-supplied File.type header (trivially
// spoofable); these are matched against the actual detected MIME from the
// first ~4KB of the file bytes via the `file-type` package.
const ALLOWED_MAGIC_BYTE_MIMES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/',
] as const

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

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
  if (file.size === 0) {
    return { path: '', error: 'File is empty.' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { path: '', error: 'File too large. Maximum size is 25MB.' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { path: '', error: `File type .${ext} is not allowed.` }
  }

  if (file.type && !ALLOWED_MIME_PREFIXES.some(prefix => file.type.startsWith(prefix))) {
    return { path: '', error: `File type ${file.type} is not allowed.` }
  }

  // M6 fix: validate the actual file bytes via magic-byte detection.
  // Defends against attackers renaming an executable as `evil.jpg` — the
  // user-supplied extension and File.type header are both trivially
  // spoofable; only the file signature in the first ~4KB is trustworthy.
  const buffer = await file.arrayBuffer()
  const validation = await validateFileBuffer(buffer, ALLOWED_MAGIC_BYTE_MIMES, MAX_FILE_SIZE)
  if (!validation.ok) {
    return { path: '', error: validation.error ?? 'File validation failed.' }
  }

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
 * Copy a file within a Supabase Storage bucket.
 * Used to clone applicant-uploaded documents into the driver's canonical path on hire.
 */
export async function copyFile(
  supabase: SupabaseClient,
  bucket: string,
  fromPath: string,
  toPath: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(bucket)
    .copy(fromPath, toPath)
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
