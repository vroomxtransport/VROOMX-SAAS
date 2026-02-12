import type { SupabaseClient } from '@supabase/supabase-js'
import type { DriverDocument, TruckDocument } from '@/types/database'

type EntityType = 'driver' | 'truck'

function getTable(entityType: EntityType) {
  return entityType === 'driver' ? 'driver_documents' : 'truck_documents'
}

function getForeignKey(entityType: EntityType) {
  return entityType === 'driver' ? 'driver_id' : 'truck_id'
}

export async function fetchDocuments<T extends EntityType>(
  supabase: SupabaseClient,
  entityType: T,
  entityId: string
): Promise<T extends 'driver' ? DriverDocument[] : TruckDocument[]> {
  const table = getTable(entityType)
  const foreignKey = getForeignKey(entityType)

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(foreignKey, entityId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as T extends 'driver' ? DriverDocument[] : TruckDocument[]
}
