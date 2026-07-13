import { describe, expect, it } from 'vitest'

import { fleetAlerts } from './alerts'
import type { FleetSnapshot } from './status'

describe('fleet alert rules', () => {
  it('surfaces stale, unknown, conflicting, and offline pilots', () => {
    const snapshot: FleetSnapshot = {
      mapId: 1,
      revision: 2,
      generatedAt: '2026-07-12T20:01:00Z',
      observedAt: '2026-07-12T20:01:00Z',
      freshness: { ageSeconds: 0, isStale: false, staleAfterSeconds: 30 },
      commanders: [],
      members: [
        { character_id: 1, character_name: 'Stale', solar_system_id: 10, observed_at: '2026-07-12T20:00:00Z' },
        { character_id: 2, character_name: 'Lost', solar_system_id: null },
        { character_id: 3, character_name: 'Conflict', solar_system_id: 11, location_state: 'uncertain' },
        { character_id: 4, character_name: 'Offline', solar_system_id: 12, online: false },
      ],
    }

    expect(fleetAlerts(snapshot, Date.parse('2026-07-12T20:01:00Z')).map(({ id }) => id)).toEqual([
      'stale-1', 'unknown-2', 'conflict-3', 'offline-4',
    ])
  })
})
