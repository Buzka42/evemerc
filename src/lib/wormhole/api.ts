import type { EveMercApi } from '../api/client'
import type { ChainConnectionUpdate, ChainSnapshot, ParsedSignature } from './types'
import type { SolarSystemDetails } from '../sde/bridge'

export async function fetchChainSnapshot(api: EveMercApi, mapSlug: string): Promise<ChainSnapshot> {
  const { data, error, response } = await api.GET('/api/v1/maps/{slug}', {
    params: { path: { slug: mapSlug } },
  })
  if (error || !data?.data) {
    throw new Error(`Chain snapshot failed with HTTP ${response.status}.`)
  }

  const map = data.data
  return {
    mapId: map.id ?? 0,
    mapSlug: map.slug ?? mapSlug,
    systems: (map.map_solarsystems ?? []).flatMap((system, index) => {
      if (typeof system.id !== 'number' || typeof system.solarsystem_id !== 'number') return []
      return [{
        id: system.id,
        solarsystemId: system.solarsystem_id,
        alias: system.alias ?? null,
        name: null,
        status: system.status ?? null,
        security: null,
        wormholeClass: null,
        effectName: null,
        statics: [],
        pinned: system.pinned ?? false,
        x: system.position?.x ?? 100 + index * 140,
        y: system.position?.y ?? 100,
        signatures: (system.signatures ?? []).flatMap((signature) => typeof signature.id === 'number' ? [{
          id: signature.id,
          signatureId: signature.signature_id ?? null,
          rawTypeName: signature.raw_type_name ?? null,
        }] : []),
      }]
    }),
    connections: (map.map_connections ?? []).flatMap((connection) => typeof connection.id === 'number' ? [{
      id: connection.id,
      fromMapSolarsystemId: connection.from_map_solarsystem_id ?? 0,
      toMapSolarsystemId: connection.to_map_solarsystem_id ?? 0,
      massStatus: connection.mass_status ?? null,
      lifetimeStatus: connection.lifetime_status ?? null,
      shipSize: connection.ship_size ?? null,
    }] : []),
    savedLocations: (map.saved_locations ?? []).flatMap((location) => typeof location.id === 'number' && typeof location.solarsystem_id === 'number' ? [{
      id: location.id,
      solarsystemId: location.solarsystem_id,
      note: location.note ?? null,
    }] : []),
  }
}

export function enrichChainSnapshot(snapshot: ChainSnapshot, details: SolarSystemDetails[]): ChainSnapshot {
  const byId = new Map(details.map((system) => [system.id, system]))
  return {
    ...snapshot,
    systems: snapshot.systems.map((system) => {
      const detail = byId.get(system.solarsystemId)
      return detail ? {
        ...system,
        name: detail.name,
        security: detail.security,
        wormholeClass: detail.wormholeClass,
        effectName: detail.effectName,
        statics: detail.statics,
      } : system
    }),
  }
}

export async function createChainSystem(api: EveMercApi, snapshot: ChainSnapshot, solarsystemId: number): Promise<void> {
  const { error } = await api.POST('/api/v1/map-solarsystems', {
    body: { map_id: String(snapshot.mapId), solarsystem_id: String(solarsystemId), pinned: false },
  })
  if (error) throw new Error('Could not add the solar system to the chain.')
}

export async function createChainConnection(api: EveMercApi, fromId: number, toId: number): Promise<void> {
  const { error } = await api.POST('/api/v1/map-connections', {
    body: { from_map_solarsystem_id: String(fromId), to_map_solarsystem_id: String(toId) },
  })
  if (error) throw new Error('Could not create the wormhole connection.')
}

export async function updateChainConnection(api: EveMercApi, id: number, update: ChainConnectionUpdate): Promise<void> {
  const { error } = await api.PUT('/api/v1/map-connections/{id}', {
    params: { path: { id } },
    body: {
      mass_status: update.massStatus,
      lifetime: update.lifetimeStatus,
      ship_size: update.shipSize,
    },
  })
  if (error) throw new Error('Could not update the wormhole connection.')
}

export async function deleteChainConnection(api: EveMercApi, id: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/map-connections/{id}', { params: { path: { id } } })
  if (error) throw new Error('Could not delete the wormhole connection.')
}

export async function moveChainSystem(api: EveMercApi, id: number, positionX: number, positionY: number): Promise<void> {
  const { error } = await api.PUT('/api/v1/map-selection', {
    body: { map_solarsystems: [{ id, position_x: positionX, position_y: positionY }] },
  })
  if (error) throw new Error('Could not save the chain system position.')
}

export async function pasteSignatures(api: EveMercApi, mapSolarsystemId: number, signatures: ParsedSignature[]): Promise<void> {
  const { error } = await api.POST('/api/v1/paste-signatures', {
    body: { map_solarsystem_id: mapSolarsystemId, signatures },
  })
  if (error) throw new Error('Could not synchronize the pasted signatures.')
}

export async function deleteSignature(api: EveMercApi, signatureId: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/signatures/{id}', { params: { path: { id: signatureId } } })
  if (error) throw new Error('Could not delete the signature.')
}

export async function deleteAllSignatures(api: EveMercApi, mapSolarsystemId: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/map-solarsystems/{mapSolarsystem_id}/signatures', {
    params: { path: { mapSolarsystem_id: mapSolarsystemId } },
  })
  if (error) throw new Error('Could not clear the signatures for this system.')
}

export async function trackTransition(
  api: EveMercApi,
  fromMapSolarsystemId: number,
  toSolarsystemId: number,
): Promise<void> {
  const { error } = await api.POST('/api/v1/tracking', {
    body: {
      from_map_solarsystem_id: fromMapSolarsystemId,
      to_solarsystem_id: toSolarsystemId,
      signature_id: null,
    },
  })
  if (error) throw new Error('Could not apply the tracked system transition.')
}

export async function importEveScoutConnections(
  api: EveMercApi,
  mapId: number,
  system: 'Thera' | 'Turnur',
): Promise<void> {
  const { error } = await api.POST('/api/v1/eve-scout-connections', {
    body: { map_id: mapId, solarsystem_name: system },
  })
  if (error) throw new Error(`Could not import current ${system} connections.`)
}

export async function saveMapLocation(
  api: EveMercApi,
  mapSlug: string,
  solarsystemId: number,
  note: string,
): Promise<void> {
  const { error } = await api.POST('/api/v1/maps/{map_slug}/saved-locations', {
    params: { path: { map_slug: mapSlug } },
    body: { solarsystem_id: solarsystemId, note: note || null },
  })
  if (error) throw new Error('Could not save the map location.')
}

export async function deleteMapLocation(api: EveMercApi, mapSlug: string, locationId: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/maps/{map_slug}/saved-locations/{savedLocation_id}', {
    params: { path: { map_slug: mapSlug, savedLocation_id: locationId } },
  })
  if (error) throw new Error('Could not delete the saved map location.')
}

export interface MapStatistics {
  systems: number
  connections: number
  signatures: number
  savedLocations: number
  fleetMembers: number
}

export async function fetchMapStatistics(api: EveMercApi, mapId: number): Promise<MapStatistics> {
  const { data, error } = await api.POST('/api/v1/statistics', { body: { map_id: mapId } })
  if (error || !data) throw new Error('Map statistics request failed.')
  return {
    systems: data.systems ?? 0,
    connections: data.connections ?? 0,
    signatures: data.signatures ?? 0,
    savedLocations: data.saved_locations ?? 0,
    fleetMembers: data.fleet_members ?? 0,
  }
}
