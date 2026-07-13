import type { EveMercApi } from '../api/client'

export interface FleetFreshness {
  ageSeconds: number | null
  isStale: boolean
  staleAfterSeconds: number
}

export interface FleetMember {
  character_id?: number
  character_name?: string
  solar_system_id?: number | null
  ship_type_id?: number | null
  ship_type_name?: string | null
  role?: string | null
  observed_at?: string
  source?: string
  location_state?: 'confirmed' | 'in_transit' | 'uncertain'
  online?: boolean
  [key: string]: unknown
}

export interface FleetSnapshot {
  mapId: number
  revision: number
  generatedAt: string
  observedAt: string | null
  freshness: FleetFreshness
  members: FleetMember[]
  commanders: Array<Record<string, unknown>>
  registration?: {
    id: number
    fleetId: number
    fleetBossName: string
  } | null
}

export async function fetchFleetSnapshot(api: EveMercApi, mapSlug: string): Promise<FleetSnapshot> {
  const { data, error, response } = await api.GET('/api/v1/maps/{map_slug}/fleet/status', {
    params: { path: { map_slug: mapSlug } },
  })

  if (error || !data?.data) {
    throw new Error(`Fleet status request failed with HTTP ${response.status}.`)
  }

  const snapshot = data.data

  return {
    mapId: snapshot.map_id ?? 0,
    revision: snapshot.revision ?? 0,
    generatedAt: snapshot.generated_at ?? new Date().toISOString(),
    observedAt: snapshot.observed_at ?? null,
    freshness: {
      ageSeconds: snapshot.freshness?.age_seconds ?? null,
      isStale: snapshot.freshness?.is_stale ?? true,
      staleAfterSeconds: snapshot.freshness?.stale_after_seconds ?? 30,
    },
    members: (snapshot.members ?? []) as FleetMember[],
    commanders: (snapshot.commanders ?? []) as Array<Record<string, unknown>>,
    registration: snapshot.registration ? {
      id: snapshot.registration.id ?? 0,
      fleetId: snapshot.registration.fleet_id ?? 0,
      fleetBossName: snapshot.registration.fleet_boss_name ?? 'Unknown',
    } : null,
  }
}

export function reconcileFleetSnapshot(
  current: FleetSnapshot | null,
  incoming: FleetSnapshot,
): FleetSnapshot {
  if (!current || incoming.revision > current.revision) {
    return incoming
  }

  if (incoming.revision < current.revision) {
    return current
  }

  return Date.parse(incoming.generatedAt) > Date.parse(current.generatedAt) ? incoming : current
}
