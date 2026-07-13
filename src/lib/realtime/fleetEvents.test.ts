import { describe, expect, it, vi } from 'vitest'

import { fleetSnapshotFromEvent } from './fleetEvents'

describe('fleet realtime events', () => {
  it('creates a revisioned snapshot without inventing missing member data', () => {
    vi.setSystemTime('2026-07-12T20:00:05Z')

    const snapshot = fleetSnapshotFromEvent({
      map_id: 4,
      registration_id: 9,
      revision: 12,
      observed_at: '2026-07-12T20:00:00Z',
      members: [{ character_id: 90000001, character_name: 'Scout', solar_system_id: null }],
    }, null)

    expect(snapshot.revision).toBe(12)
    expect(snapshot.freshness.ageSeconds).toBe(5)
    expect(snapshot.members[0]?.solar_system_id).toBeNull()
    vi.useRealTimers()
  })
})
