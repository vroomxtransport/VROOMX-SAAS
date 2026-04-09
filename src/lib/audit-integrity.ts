import { createHash } from 'crypto'

export function computeIntegrityHash(
  previousHash: string | null,
  eventData: {
    tenantId: string
    entityType: string
    entityId: string
    action: string
    actorId: string
    createdAt: string
  }
): string {
  const payload = [
    previousHash ?? 'GENESIS',
    eventData.tenantId,
    eventData.entityType,
    eventData.entityId,
    eventData.action,
    eventData.actorId,
    eventData.createdAt,
  ].join('|')

  return createHash('sha256').update(payload).digest('hex')
}
