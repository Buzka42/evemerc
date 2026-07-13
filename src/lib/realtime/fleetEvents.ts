import type { FleetMember, FleetSnapshot } from '../fleet/status'

export interface FleetMembersUpdatedPayload {
  map_id: number
  registration_id: number
  revision: number
  observed_at: string
  members: FleetMember[]
}

export interface CharacterLocationObservedPayload {
  map_id: number
  character_id: number
  solar_system_id: number
  observed_at: string
  state: 'confirmed' | 'in_transit' | 'uncertain'
  source: string
  revision: number
}

export interface FleetWaypointSetPayload {
  map_id: number
  destination_solarsystem_id: number
  destination_name: string
  set_by_character_name: string
  character_count: number
}

export function fleetSnapshotFromEvent(
  payload: FleetMembersUpdatedPayload,
  current: FleetSnapshot | null,
): FleetSnapshot {
  const generatedAt = new Date().toISOString()

  return {
    mapId: payload.map_id,
    revision: payload.revision,
    generatedAt,
    observedAt: payload.observed_at,
    freshness: {
      ageSeconds: Math.max(0, Math.floor((Date.now() - Date.parse(payload.observed_at)) / 1000)),
      isStale: false,
      staleAfterSeconds: current?.freshness.staleAfterSeconds ?? 30,
    },
    members: payload.members,
    commanders: current?.commanders ?? [],
  }
}
