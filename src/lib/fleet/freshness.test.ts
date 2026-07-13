import { describe, expect, it } from 'vitest'

import { memberFreshness } from './freshness'

describe('fleet member freshness', () => {
  it('distinguishes current, stale, and unknown pilot observations', () => {
    const now = Date.parse('2026-07-12T20:01:00Z')

    expect(memberFreshness({ observed_at: '2026-07-12T20:00:50Z' }, now).state).toBe('current')
    expect(memberFreshness({ observed_at: '2026-07-12T20:00:00Z' }, now).state).toBe('stale')
    expect(memberFreshness({}, now)).toEqual({ ageSeconds: null, state: 'unknown' })
  })
})
