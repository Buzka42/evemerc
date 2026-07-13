import { describe, expect, it } from 'vitest'

import { reconcileFleetSnapshot, type FleetSnapshot } from './status'

function snapshot(revision: number, generatedAt = '2026-07-12T20:00:00Z'): FleetSnapshot {
  return {
    mapId: 1,
    revision,
    generatedAt,
    observedAt: generatedAt,
    freshness: { ageSeconds: 0, isStale: false, staleAfterSeconds: 30 },
    members: [],
    commanders: [],
  }
}

describe('fleet snapshot reconciliation', () => {
  it('accepts a newer revision and rejects a delayed older event', () => {
    const current = snapshot(8)

    expect(reconcileFleetSnapshot(current, snapshot(9)).revision).toBe(9)
    expect(reconcileFleetSnapshot(current, snapshot(7))).toBe(current)
  })

  it('uses generation time only to break an equal-revision tie', () => {
    const current = snapshot(8)
    const refreshed = snapshot(8, '2026-07-12T20:00:01Z')

    expect(reconcileFleetSnapshot(current, refreshed)).toBe(refreshed)
  })
})
