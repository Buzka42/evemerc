import type { EveMercApi } from '../api/client'

export async function registerFleet(api: EveMercApi, mapSlug: string): Promise<void> {
  const { error, response } = await api.POST('/api/v1/maps/{map_slug}/fleet/register', {
    params: { path: { map_slug: mapSlug } },
  })
  if (error) {
    throw new Error(apiMessage(error, `Fleet registration failed with HTTP ${response.status}.`))
  }
}

export async function deregisterFleet(api: EveMercApi, mapSlug: string): Promise<void> {
  const { error } = await api.DELETE('/api/v1/maps/{map_slug}/fleet/deregister', {
    params: { path: { map_slug: mapSlug } },
  })
  if (error) {
    throw new Error(apiMessage(error, 'Fleet deregistration failed.'))
  }
}

export async function setFleetWaypoint(
  api: EveMercApi,
  mapSlug: string,
  destinationId: number,
): Promise<{ destinationName: string; characterCount: number }> {
  const { data, error, response } = await api.POST('/api/v1/maps/{map_slug}/fleet/waypoint', {
    params: { path: { map_slug: mapSlug } },
    body: { destination_id: destinationId },
  })
  if (error || !data?.data) {
    throw new Error(apiMessage(error, `Fleet waypoint failed with HTTP ${response.status}.`))
  }

  return {
    destinationName: data.data.destination_name ?? `System ${destinationId}`,
    characterCount: data.data.character_count ?? 0,
  }
}

export async function appointFleetCommander(
  api: EveMercApi,
  mapSlug: string,
  characterId: number,
): Promise<void> {
  const { error } = await api.POST('/api/v1/maps/{map_slug}/fleet/commanders', {
    params: { path: { map_slug: mapSlug } },
    body: { character_id: characterId, can_set_destination: true, can_manage_fleet: false },
  })
  if (error) {
    throw new Error(apiMessage(error, 'Commander appointment failed.'))
  }
}

export async function removeFleetCommander(
  api: EveMercApi,
  mapSlug: string,
  commanderId: number,
): Promise<void> {
  const { error } = await api.DELETE('/api/v1/maps/{map_slug}/fleet/commanders/{id}', {
    params: { path: { map_slug: mapSlug, id: commanderId } },
  })
  if (error) {
    throw new Error(apiMessage(error, 'Commander removal failed.'))
  }
}

function apiMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}
