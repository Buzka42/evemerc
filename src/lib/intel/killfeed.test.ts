import { describe, expect, it } from 'vitest'
import { normalizeFleetKills, zkillUrl } from './killfeed'

describe('fleet killfeed', () => {
  it('normalizes enriched killmail data and rejects incomplete rows', () => {
    expect(normalizeFleetKills([
      {
        killmail_id: 42,
        killmail_time: '2026-07-13T00:00:00Z',
        fleet_involvement: 'loss',
        victim: { character_name: 'Scout', ship_type_name: 'Buzzard' },
        final_blow: { character_name: 'Hunter' },
        attacker_count: 4,
        zkb: { totalValue: 125000000 },
      },
      { victim: {} },
    ])).toEqual([{
      id: 42,
      time: '2026-07-13T00:00:00Z',
      involvement: 'loss',
      victimName: 'Scout',
      victimShip: 'Buzzard',
      finalBlowName: 'Hunter',
      attackerCount: 4,
      value: 125000000,
    }])
  })

  it('builds the canonical external kill URL', () => {
    expect(zkillUrl(42)).toBe('https://zkillboard.com/kill/42/')
  })
})
