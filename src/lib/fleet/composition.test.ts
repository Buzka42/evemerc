import { describe, expect, it } from 'vitest'
import { CompositionHistory, countByShipType } from './composition'
import type { FleetMember } from './status'

function member(shipTypeName: string | null): FleetMember {
  return { character_id: Math.random(), ship_type_name: shipTypeName }
}

describe('countByShipType', () => {
  it('groups members by ship type name, falling back to Unknown', () => {
    const counts = countByShipType([member('Loki'), member('Loki'), member('Guardian'), member(null)])
    expect(counts.get('Loki')).toBe(2)
    expect(counts.get('Guardian')).toBe(1)
    expect(counts.get('Unknown')).toBe(1)
  })
})

describe('CompositionHistory', () => {
  it('shows a zero delta before any history has aged past the 5-minute window', () => {
    let now = 0
    const history = new CompositionHistory(() => now)
    history.record([member('Loki'), member('Loki')])

    const composition = history.composition([member('Loki'), member('Loki'), member('Guardian')])
    const loki = composition.find((entry) => entry.shipTypeName === 'Loki')
    expect(loki?.delta).toBe(0)
  })

  it('computes a gain/loss delta against the closest snapshot at least 5 minutes old', () => {
    let now = 0
    const history = new CompositionHistory(() => now)

    history.record([member('Loki'), member('Loki')]) // t=0: 2 Loki
    now = 5 * 60 * 1000 + 1 // just past 5 minutes later
    history.record([member('Loki'), member('Loki'), member('Loki'), member('Guardian')]) // 3 Loki, 1 Guardian

    const composition = history.composition([member('Loki'), member('Loki'), member('Loki'), member('Guardian')])
    const loki = composition.find((entry) => entry.shipTypeName === 'Loki')
    const guardian = composition.find((entry) => entry.shipTypeName === 'Guardian')

    expect(loki).toEqual({ shipTypeName: 'Loki', count: 3, delta: 1 })
    expect(guardian).toEqual({ shipTypeName: 'Guardian', count: 1, delta: 1 })
  })

  it('excludes ship types with zero current count and sorts by count descending', () => {
    let now = 0
    const history = new CompositionHistory(() => now)
    history.record([member('Loki'), member('Guardian'), member('Guardian')])

    const composition = history.composition([member('Guardian'), member('Guardian'), member('Guardian')])
    expect(composition.map((entry) => entry.shipTypeName)).toEqual(['Guardian'])
  })

  it('prunes history older than 10 minutes', () => {
    let now = 0
    const history = new CompositionHistory(() => now)
    history.record([member('Loki')])

    now = 11 * 60 * 1000
    history.record([member('Loki'), member('Loki')])

    // The t=0 snapshot should have been pruned; only the most recent point remains, which is
    // within the 5-minute window, so delta should be 0, not computed against the pruned snapshot.
    const composition = history.composition([member('Loki'), member('Loki')])
    expect(composition.find((entry) => entry.shipTypeName === 'Loki')?.delta).toBe(0)
  })
})
