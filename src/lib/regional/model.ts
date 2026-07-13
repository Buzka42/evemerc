import type { FleetMember } from '../fleet/status'
import type { RegionalLayerData } from '../modules/types'
import type { RegionTopology } from '../sde/bridge'

export interface MapPoint {
  x: number
  y: number
}

export interface RegionalMapModel {
  positions: Map<number, MapPoint>
  pilotCounts: Map<number, number>
  intelIndicators: Map<number, { intensity: number; label: string; color: string }>
  sovereignty: Map<number, { label: string; color: string }>
}

export function buildRegionalMapModel(
  topology: RegionTopology,
  members: FleetMember[],
  layers: RegionalLayerData[],
): RegionalMapModel {
  const xs = topology.systems.map((system) => system.positionX)
  const zs = topology.systems.map((system) => system.positionZ)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxZ - minZ)
  const positions = new Map(topology.systems.map((system) => [system.id, {
    x: 50 + ((system.positionX - minX) / width) * 900,
    y: 40 + ((system.positionZ - minZ) / height) * 500,
  }]))

  const pilotCounts = new Map<number, number>()
  for (const member of members) {
    if (typeof member.solar_system_id === 'number') {
      pilotCounts.set(member.solar_system_id, (pilotCounts.get(member.solar_system_id) ?? 0) + 1)
    }
  }

  const intelIndicators = new Map<number, { intensity: number; label: string; color: string }>()
  const sovereignty = new Map<number, { label: string; color: string }>()
  for (const layer of layers) {
    for (const [systemId, indicator] of Object.entries(layer.indicators)) {
      intelIndicators.set(Number(systemId), indicator)
    }
    for (const [systemId, ring] of Object.entries(layer.rings ?? {})) {
      sovereignty.set(Number(systemId), ring)
    }
  }

  return { positions, pilotCounts, intelIndicators, sovereignty }
}
