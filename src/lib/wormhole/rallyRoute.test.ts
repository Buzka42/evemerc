import { describe, expect, it } from 'vitest'
import { jumpsBetween } from './rallyRoute'
import type { ChainSnapshot } from './types'

function snapshot(connections: { from: number; to: number }[]): ChainSnapshot {
  return {
    mapId: 1,
    mapSlug: 'test',
    homeSolarsystemId: null,
    rallySolarsystemId: null,
    systems: [],
    connections: connections.map((connection, index) => ({
      id: index,
      fromMapSolarsystemId: connection.from,
      toMapSolarsystemId: connection.to,
      massStatus: null,
      lifetimeStatus: null,
      shipSize: null,
    })),
    savedLocations: [],
  }
}

describe('jumpsBetween', () => {
  it('returns 0 for the same system', () => {
    expect(jumpsBetween(snapshot([]), 1, 1)).toBe(0)
  })

  it('finds the shortest hop count across a chain', () => {
    const chain = snapshot([{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 }])
    expect(jumpsBetween(chain, 1, 4)).toBe(3)
  })

  it('finds a shorter path when a branch offers a shortcut', () => {
    const chain = snapshot([
      { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 },
      { from: 1, to: 4 },
    ])
    expect(jumpsBetween(chain, 1, 4)).toBe(1)
  })

  it('returns null when there is no path', () => {
    const chain = snapshot([{ from: 1, to: 2 }])
    expect(jumpsBetween(chain, 1, 99)).toBeNull()
  })
})
