'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'

interface AuditEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  description: string | null
  actor_email: string | null
  created_at: string
}

interface Props {
  applicationId: string
}

function useApplicationActivity(applicationId: string) {
  const supabase = createClient()

  return useQuery<AuditEntry[]>({
    queryKey: ['activity', applicationId],
    queryFn: async () => {
      // Resolve the pipeline + step IDs owned by this application so we can
      // match audit entries whose entity_id points at a child row rather than
      // the application itself. UUIDs are not hierarchical, so a LIKE prefix
      // filter cannot be used here.
      const { data: pipelineRow } = await supabase
        .from('driver_onboarding_pipelines')
        .select('id')
        .eq('application_id', applicationId)
        .maybeSingle()

      const pipelineId = pipelineRow?.id as string | undefined

      let stepIds: string[] = []
      if (pipelineId) {
        const { data: stepRows } = await supabase
          .from('driver_onboarding_steps')
          .select('id')
          .eq('pipeline_id', pipelineId)
        stepIds = (stepRows ?? []).map((r) => r.id as string)
      }

      // Build the OR filter with real IDs. Always include the application row
      // itself. Include pipeline and step filters only if they resolved, so
      // we never emit an empty `in.()` clause.
      const orClauses: string[] = [
        `and(entity_type.eq.driver_application,entity_id.eq.${applicationId})`,
      ]
      if (pipelineId) {
        orClauses.push(
          `and(entity_type.eq.driver_onboarding_pipeline,entity_id.eq.${pipelineId})`,
        )
      }
      if (stepIds.length > 0) {
        orClauses.push(
          `and(entity_type.eq.driver_onboarding_step,entity_id.in.(${stepIds.join(',')}))`,
        )
      }

      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, entity_type, entity_id, action, description, actor_email, created_at')
        .or(orClauses.join(','))
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data ?? []) as AuditEntry[]
    },
    staleTime: 30_000,
  })
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'application.submitted': 'Application submitted',
    'application.status_changed': 'Status changed',
    'pipeline.created': 'Pipeline started',
    'pipeline.approved': 'Pipeline approved',
    'pipeline.rejected': 'Pipeline rejected',
    'step.status_changed': 'Step status updated',
    'step.waived': 'Step waived',
    'step.assigned': 'Step assigned',
    'pre_adverse.sent': 'Pre-adverse notice sent',
    'adverse_action.finalized': 'Adverse action finalized',
  }
  return map[action] ?? action
}

export function ActivityTab({ applicationId }: Props) {
  const { data: entries, isLoading, error } = useApplicationActivity(applicationId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1 pt-1">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        Failed to load activity log.
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-surface/50">
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-3.5 top-4 bottom-4 w-px bg-border" aria-hidden />

      <div className="space-y-0">
        {entries.map((entry) => (
          <div key={entry.id} className="relative flex gap-4 pb-5 last:pb-0">
            {/* Dot */}
            <div
              className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground"
              aria-hidden
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm font-medium text-foreground">
                {actionLabel(entry.action)}
              </p>
              {entry.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {entry.description}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {entry.actor_email && <span>{entry.actor_email}</span>}
                {entry.actor_email && <span aria-hidden>·</span>}
                <time dateTime={entry.created_at}>
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </time>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
