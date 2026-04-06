import { NextResponse } from 'next/server'
import { authorize } from '@/lib/authz'
import JSZip from 'jszip'
import { COMPLIANCE_SUB_CATEGORY_LABELS } from '@/types'
import type { ComplianceSubCategory } from '@/types'

type DocumentType = 'dqf' | 'vehicle_qualification' | 'company_document'
type EntityType = 'driver' | 'truck' | 'company'

const VALID_DOCUMENT_TYPES = new Set<DocumentType>(['dqf', 'vehicle_qualification', 'company_document'])
const VALID_ENTITY_TYPES = new Set<EntityType>(['driver', 'truck', 'company'])

const STORAGE_BUCKET = 'documents'

export async function GET(request: Request) {
  // 1. Parse + validate query params
  const url = new URL(request.url)
  const rawDocumentType = url.searchParams.get('documentType')
  const rawEntityType = url.searchParams.get('entityType')
  const entityId = url.searchParams.get('entityId') // null is valid for company-level

  if (!rawDocumentType || !VALID_DOCUMENT_TYPES.has(rawDocumentType as DocumentType)) {
    return NextResponse.json(
      { error: 'Missing or invalid documentType. Must be one of: dqf, vehicle_qualification, company_document' },
      { status: 400 }
    )
  }

  if (!rawEntityType || !VALID_ENTITY_TYPES.has(rawEntityType as EntityType)) {
    return NextResponse.json(
      { error: 'Missing or invalid entityType. Must be one of: driver, truck, company' },
      { status: 400 }
    )
  }

  const documentType = rawDocumentType as DocumentType
  const entityType = rawEntityType as EntityType

  // 2. Authorize — requires compliance.read permission, RLS handles tenant isolation
  const auth = await authorize('compliance.read')
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 403 })
  }
  const { supabase, tenantId } = auth.ctx

  // 3. Fetch all docs for the entity (explicit tenant_id filter + RLS = defense in depth)
  let query = supabase
    .from('compliance_documents')
    .select('id, sub_category, file_name, storage_path, created_at')
    .eq('document_type', documentType)
    .eq('entity_type', entityType)
    .eq('tenant_id', tenantId)
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })

  if (entityId) {
    query = query.eq('entity_id', entityId)
  }

  const { data: docs, error: fetchError } = await query

  if (fetchError) {
    console.error('[compliance/download] fetch failed:', fetchError.message)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No documents found' }, { status: 404 })
  }

  // 4. Build the ZIP — sequential downloads to avoid memory spikes with large document sets
  const zip = new JSZip()
  let addedCount = 0

  for (const doc of docs) {
    if (!doc.storage_path || !doc.file_name) continue

    try {
      const { data: blob, error: dlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(doc.storage_path)

      if (dlError || !blob) {
        console.warn(`[compliance/download] skipping doc ${doc.id}:`, dlError?.message ?? 'no blob returned')
        continue
      }

      // Map sub_category to human-readable folder label
      const folderLabel =
        (COMPLIANCE_SUB_CATEGORY_LABELS as Record<string, string>)[doc.sub_category as ComplianceSubCategory] ??
        doc.sub_category

      // Sanitize path components — strip characters forbidden in most filesystems
      const safeFolder = folderLabel.replace(/[/\\:*?"<>|]/g, '-')
      const safeFileName = (doc.file_name as string).replace(/[/\\:*?"<>|]/g, '-')

      // Prefix with ISO date to disambiguate multiple files with the same name in the same folder
      const datePrefix = (doc.created_at as string).slice(0, 10)
      const finalName = `${datePrefix}_${safeFileName}`

      const arrayBuffer = await blob.arrayBuffer()
      zip.file(`${safeFolder}/${finalName}`, arrayBuffer)
      addedCount++
    } catch (err) {
      console.warn(`[compliance/download] skipping doc ${doc.id}:`, err)
    }
  }

  if (addedCount === 0) {
    return NextResponse.json({ error: 'No files could be downloaded from storage' }, { status: 500 })
  }

  // 5. Generate ZIP buffer
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  // 6. Build a descriptive filename
  const datestamp = new Date().toISOString().slice(0, 10)
  const filename = `${entityType}-${entityId ?? 'company'}-documents-${datestamp}.zip`

  // 7. Return as a streaming download
  return new NextResponse(zipBuffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': zipBuffer.length.toString(),
    },
  })
}
