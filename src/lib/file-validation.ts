/**
 * Server-side file validation via magic byte (file signature) detection.
 *
 * Used by storage.uploadFile() and the photo-upload server action to defend
 * against attackers uploading executables or scripts renamed with allowed
 * extensions (e.g. `evil.exe` → `evil.jpg`). Extension and MIME-type checks
 * alone are trivially spoofable; only the actual file bytes are trustworthy.
 *
 * Backed by the `file-type` package which inspects up to ~4100 bytes from
 * the start of the buffer and identifies common formats (PDF, JPEG, PNG,
 * WebP, HEIC, GIF, ZIP-based docs like .docx/.xlsx, etc.).
 */

import { fileTypeFromBuffer } from 'file-type'

export interface FileValidationResult {
  ok: boolean
  /** Detected MIME type from magic bytes (only set when ok=true) */
  mime?: string
  /** Detected canonical extension (only set when ok=true) */
  ext?: string
  /** Human-readable error message (only set when ok=false) */
  error?: string
}

/**
 * Validate a file buffer against an allowlist of MIME types or MIME prefixes.
 *
 * @param buffer        - Raw file bytes (from File.arrayBuffer() or similar)
 * @param allowedMimes  - Array of full MIME types (e.g. 'image/jpeg') or
 *                        prefixes ending in '/' (e.g. 'image/' to match all images)
 * @param maxBytes      - Optional size cap. If provided and exceeded, returns
 *                        ok=false without inspecting bytes.
 */
export async function validateFileBuffer(
  buffer: ArrayBuffer | Uint8Array,
  allowedMimes: readonly string[],
  maxBytes?: number
): Promise<FileValidationResult> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

  if (bytes.byteLength === 0) {
    return { ok: false, error: 'File is empty.' }
  }

  if (maxBytes != null && bytes.byteLength > maxBytes) {
    return {
      ok: false,
      error: `File too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)}MB.`,
    }
  }

  // file-type uses the first ~4KB of the buffer to identify the format.
  // Returns undefined if no signature matches (truly unknown / text / etc.).
  const detected = await fileTypeFromBuffer(bytes)

  if (!detected) {
    // No magic-byte signature found. Could be plain text, CSV, JSON, etc.
    // Caller can choose to allow text/* explicitly via the allowlist if so.
    if (allowedMimes.some((m) => m.startsWith('text/'))) {
      return { ok: true, mime: 'text/plain', ext: 'txt' }
    }
    return {
      ok: false,
      error: 'Unable to identify file type from contents. Please upload a supported format.',
    }
  }

  const detectedMime = detected.mime
  const matched = allowedMimes.some((allowed) => {
    if (allowed.endsWith('/')) {
      return detectedMime.startsWith(allowed)
    }
    return detectedMime === allowed
  })

  if (!matched) {
    return {
      ok: false,
      error: `File contents do not match any allowed type. Detected: ${detectedMime}`,
      mime: detectedMime,
      ext: detected.ext,
    }
  }

  return { ok: true, mime: detectedMime, ext: detected.ext }
}

/**
 * Convenience: validate a browser File object directly. Reads the bytes
 * via file.arrayBuffer() and forwards to validateFileBuffer.
 */
export async function validateFile(
  file: File,
  allowedMimes: readonly string[],
  maxBytes?: number
): Promise<FileValidationResult> {
  const buffer = await file.arrayBuffer()
  return validateFileBuffer(buffer, allowedMimes, maxBytes)
}
