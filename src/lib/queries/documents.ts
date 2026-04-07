import type { SupabaseClient } from '@supabase/supabase-js'
import type { DriverDocument, TruckDocument } from '@/types/database'

type EntityType = 'driver' | 'truck'

// M4: explicit column allowlist instead of SELECT *. driver_documents and
// truck_documents share the same column structure (modulo the FK name).
const DRIVER_DOC_COLUMNS =
  'id, tenant_id, driver_id, document_type, file_name, storage_path, ' +
  'file_size, expires_at, uploaded_by, created_at'

const TRUCK_DOC_COLUMNS =
  'id, tenant_id, truck_id, document_type, file_name, storage_path, ' +
  'file_size, expires_at, uploaded_by, created_at'

function getTable(entityType: EntityType) {
  return entityType === 'driver' ? 'driver_documents' : 'truck_documents'
}

function getForeignKey(entityType: EntityType) {
  return entityType === 'driver' ? 'driver_id' : 'truck_id'
}

function getColumns(entityType: EntityType) {
  return entityType === 'driver' ? DRIVER_DOC_COLUMNS : TRUCK_DOC_COLUMNS
}

export async function fetchDocuments<T extends EntityType>(
  supabase: SupabaseClient,
  entityType: T,
  entityId: string
): Promise<T extends 'driver' ? DriverDocument[] : TruckDocument[]> {
  const table = getTable(entityType)
  const foreignKey = getForeignKey(entityType)
  const columns = getColumns(entityType)

  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq(foreignKey, entityId)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Constant column list (M4) defeats Supabase's literal-string row
  // inference; cast through unknown to the known shape.
  return ((data ?? []) as unknown) as T extends 'driver'
    ? DriverDocument[]
    : TruckDocument[]
}
