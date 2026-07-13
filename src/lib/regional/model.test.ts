import { describe, expect, it } from 'vitest'
import { performance } from 'node:perf_hooks'
import { buildRegionalMapModel } from './model'
import type { FleetMember } from '../fleet/status'
import type { RegionTopology } from '../sde/bridge'

describe('regional map performance', () => {
  it('keeps the p95 projection time for 500 fleet markers below 250ms', () => {
    const topology: RegionTopology = {
      systems: Array.from({ length: 500 }, (_, index) => ({
        id: 30_000_000 + index,
        name: `System ${index}`,
        security: 0,
        positionX: index * 10,
        positionZ: (index % 31) * 20,
      })),
      jumps: [],
    }
    const members = Array.from({ length: 500 }, (_, index) => ({
      character_id: 90_000_000 + index,
      solar_system_id: 30_000_000 + (index % 500),
    })) as FleetMember[]
    const samples = Array.from({ length: 100 }, () => {
      const start = performance.now()
      const model = buildRegionalMapModel(topology, members, [])
      expect(model.pilotCounts.size).toBe(500)
      return performance.now() - start
    }).sort((left, right) => left - right)

    expect(samples[Math.floor(samples.length * 0.95)]).toBeLessThan(250)
  })
})
