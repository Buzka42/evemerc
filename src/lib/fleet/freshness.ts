import type { FleetMember } from './status'

export interface MemberFreshness {
  ageSeconds: number | null
  state: 'current' | 'stale' | 'unknown'
}

export function memberFreshness(
  member: FleetMember,
  now = Date.now(),
  staleAfterSeconds = 30,
): MemberFreshness {
  if (!member.observed_at) {
    return { ageSeconds: null, state: 'unknown' }
  }

  const observedAt = Date.parse(member.observed_at)
  if (!Number.isFinite(observedAt)) {
    return { ageSeconds: null, state: 'unknown' }
  }

  const ageSeconds = Math.max(0, Math.floor((now - observedAt) / 1000))
  return {
    ageSeconds,
    state: ageSeconds > staleAfterSeconds ? 'stale' : 'current',
  }
}
