import type { ScheduleOption } from '@/lib/validations/scheduled-reports'

/**
 * Given a schedule key, return the next UTC timestamp at which the report
 * should fire. All times are anchored to 08:00 UTC so recipients receive the
 * report in the morning regardless of timezone.
 */
export function computeNextRunAt(schedule: ScheduleOption): Date {
  const now = new Date()

  function at8utc(d: Date): Date {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0, 0)
    )
  }

  function nextFuture(candidate: Date): Date {
    return candidate > now ? candidate : new Date(candidate.getTime() + 7 * 86_400_000)
  }

  switch (schedule) {
    case 'daily': {
      const candidate = at8utc(new Date(now.getTime() + 86_400_000))
      const today = at8utc(now)
      return today > now ? today : candidate
    }

    case 'weekly_monday': {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const dayOfWeek = d.getUTCDay()
      const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7
      d.setUTCDate(d.getUTCDate() + daysUntilMonday)
      return nextFuture(at8utc(d))
    }

    case 'weekly_friday': {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const dayOfWeek = d.getUTCDay()
      const daysUntilFriday = dayOfWeek === 5 ? 7 : (12 - dayOfWeek) % 7 || 7
      d.setUTCDate(d.getUTCDate() + daysUntilFriday)
      return nextFuture(at8utc(d))
    }

    case 'monthly_1': {
      let year = now.getUTCFullYear()
      let month = now.getUTCMonth() + 1
      if (month > 11) { month = 0; year++ }
      return at8utc(new Date(Date.UTC(year, month, 1)))
    }

    case 'monthly_15': {
      const candidateCurrent = at8utc(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15))
      )
      if (candidateCurrent > now) return candidateCurrent
      let year = now.getUTCFullYear()
      let month = now.getUTCMonth() + 1
      if (month > 11) { month = 0; year++ }
      return at8utc(new Date(Date.UTC(year, month, 15)))
    }
  }
}
