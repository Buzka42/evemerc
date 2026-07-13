import { describe, expect, it } from 'vitest'

import { applyLocalJump } from './localJump'
import type { FleetSnapshot } from './status'

describe('local fleet jump observation', () => {
  it('moves only the matching pilot and preserves the server revision', () => {
    const snapshot: FleetSnapshot = {
      mapId: 1,
      revision: 9,
      generatedAt: '2026-07-12T20:00:00Z',
      observedAt: '2026-07-12T20:00:00Z',
      freshness: { ageSeconds: 0, isStale: false, staleAfterSeconds: 30 },
      commanders: [],
      members: [{ character_id: 10, solar_system_id: 1 }, { character_id: 11, solar_system_id: 2 }],
    }

    const moved = applyLocalJump(snapshot, 10, 3, '2026-07-12T20:00:05Z')

    expect(moved.revision).toBe(9)
    expect(moved.members[0]).toMatchObject({ solar_system_id: 3, source: 'eve_gamelog', location_state: 'in_transit' })
    expect(moved.members[1]?.solar_system_id).toBe(2)
  })
})
