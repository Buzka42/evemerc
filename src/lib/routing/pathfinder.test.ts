import { describe, expect, it } from 'vitest'
import { UniverseGraph, dynamicConnectionsFromChain, findClosestSystems, findRoute, type RoutingSettings } from './pathfinder'
import type { RegionTopology } from '../sde/bridge'
import type { ChainSnapshot } from '../wormhole/types'

const defaultSettings: RoutingSettings = {
  routePreference: 'shorter',
  securityPenalty: 0,
  lifetimeStatus: 'critical',
  massStatus: 'critical',
}

// A -- B -- C -- D  (a simple chain, all highsec)
// B -- E (lowsec), E -- D (lowsec)
function chainTopology(): RegionTopology {
  return {
    systems: [
      { id: 1, name: 'A', security: 0.9, positionX: 0, positionZ: 0 },
      { id: 2, name: 'B', security: 0.9, positionX: 0, positionZ: 0 },
      { id: 3, name: 'C', security: 0.9, positionX: 0, positionZ: 0 },
      { id: 4, name: 'D', security: 0.9, positionX: 0, positionZ: 0 },
      { id: 5, name: 'E', security: 0.2, positionX: 0, positionZ: 0 },
    ],
    jumps: [
      { fromSystemId: 1, toSystemId: 2 },
      { fromSystemId: 2, toSystemId: 3 },
      { fromSystemId: 3, toSystemId: 4 },
      { fromSystemId: 2, toSystemId: 5 },
      { fromSystemId: 5, toSystemId: 4 },
    ],
  }
}

describe('findRoute', () => {
  it('finds the shortest stargate path', () => {
    const universe = new UniverseGraph(chainTopology())
    const result = findRoute(universe, defaultSettings, 1, 4, [], [])
    expect(result.jumps).toBe(3)
    expect(result.route.map((step) => step.id)).toEqual([1, 2, 3, 4])
    expect(result.route.every((step) => step.via === null || step.via === 'stargate')).toBe(true)
  })

  it('returns an empty route when no path exists', () => {
    const universe = new UniverseGraph({
      systems: [
        { id: 1, name: 'A', security: 0.9, positionX: 0, positionZ: 0 },
        { id: 2, name: 'B', security: 0.9, positionX: 0, positionZ: 0 },
      ],
      jumps: [],
    })
    const result = findRoute(universe, defaultSettings, 1, 2, [], [])
    expect(result.route).toEqual([])
    expect(result.jumps).toBe(0)
  })

  it('prefers a shorter path through a wormhole shortcut over stargates', () => {
    const universe = new UniverseGraph(chainTopology())
    const wormhole = [{ from: 1, to: 4, type: 'wormhole' as const, massStatus: 'fresh' as const, lifetimeStatus: 'healthy' as const }]
    const result = findRoute(universe, defaultSettings, 1, 4, wormhole, [])
    expect(result.jumps).toBe(1)
    expect(result.route.map((step) => step.id)).toEqual([1, 4])
    expect(result.route[1].via).toBe('wormhole')
  })

  it('excludes a wormhole whose mass status is worse than the configured filter', () => {
    const universe = new UniverseGraph(chainTopology())
    const wormhole = [{ from: 1, to: 4, type: 'wormhole' as const, massStatus: 'critical' as const, lifetimeStatus: 'healthy' as const }]
    const strict: RoutingSettings = { ...defaultSettings, massStatus: 'fresh' }
    const result = findRoute(universe, strict, 1, 4, wormhole, [])
    // falls back to the 3-jump stargate path since the wormhole is filtered out
    expect(result.jumps).toBe(3)
  })

  it('routes around an ignored system', () => {
    const universe = new UniverseGraph(chainTopology())
    const result = findRoute(universe, defaultSettings, 1, 4, [], [3])
    expect(result.route.map((step) => step.id)).toEqual([1, 2, 5, 4])
  })

  it('never routes through Zarzakh even when it is the shortest path', () => {
    const universe = new UniverseGraph({
      systems: [
        { id: 1, name: 'A', security: 0.9, positionX: 0, positionZ: 0 },
        { id: 30_100_000, name: 'Zarzakh', security: -1, positionX: 0, positionZ: 0 },
        { id: 2, name: 'B', security: 0.9, positionX: 0, positionZ: 0 },
        { id: 3, name: 'C', security: 0.9, positionX: 0, positionZ: 0 },
        { id: 4, name: 'D', security: 0.9, positionX: 0, positionZ: 0 },
      ],
      jumps: [
        { fromSystemId: 1, toSystemId: 30_100_000 },
        { fromSystemId: 30_100_000, toSystemId: 4 },
        { fromSystemId: 1, toSystemId: 2 },
        { fromSystemId: 2, toSystemId: 3 },
        { fromSystemId: 3, toSystemId: 4 },
      ],
    })
    const result = findRoute(universe, defaultSettings, 1, 4, [], [])
    expect(result.route.map((step) => step.id)).not.toContain(30_100_000)
    expect(result.jumps).toBe(3)
  })

  it('prefers the higher-security path when routePreference is safer', () => {
    const universe = new UniverseGraph(chainTopology())
    const safer: RoutingSettings = { ...defaultSettings, routePreference: 'safer' }
    const result = findRoute(universe, safer, 1, 4, [], [])
    // C is highsec (0.9), the direct route through C should win over the lowsec E detour
    expect(result.route.map((step) => step.id)).toEqual([1, 2, 3, 4])
  })
})

describe('findClosestSystems', () => {
  it('finds the closest lowsec system by jump count', () => {
    const universe = new UniverseGraph(chainTopology())
    const results = findClosestSystems(universe, defaultSettings, 1, 'lowsec', 5, [], [])
    expect(results).toHaveLength(1)
    expect(results[0].solarsystemId).toBe(5)
    expect(results[0].jumps).toBe(2)
  })

  it('respects the result limit', () => {
    const universe = new UniverseGraph(chainTopology())
    const results = findClosestSystems(universe, defaultSettings, 1, 'highsec', 2, [], [])
    expect(results.length).toBeLessThanOrEqual(2)
  })
})

describe('dynamicConnectionsFromChain', () => {
  it('translates map_solarsystem-id connections to raw solarsystem ids', () => {
    const snapshot: ChainSnapshot = {
      mapId: 1,
      mapSlug: 'test',
      homeSolarsystemId: null,
      rallySolarsystemId: null,
      systems: [
        { id: 100, solarsystemId: 30000142, alias: null, name: null, status: null, security: null, wormholeClass: null, effectName: null, statics: [], pinned: false, x: 0, y: 0, signatures: [] },
        { id: 101, solarsystemId: 30000144, alias: null, name: null, status: null, security: null, wormholeClass: null, effectName: null, statics: [], pinned: false, x: 0, y: 0, signatures: [] },
      ],
      connections: [
        { id: 1, fromMapSolarsystemId: 100, toMapSolarsystemId: 101, massStatus: 'fresh', lifetimeStatus: 'healthy', shipSize: 'large' },
      ],
      savedLocations: [],
    }

    const connections = dynamicConnectionsFromChain(snapshot)
    expect(connections).toEqual([{ from: 30000142, to: 30000144, type: 'wormhole', massStatus: 'fresh', lifetimeStatus: 'healthy' }])
  })
})
