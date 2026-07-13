import type { EveMercApi } from '../api/client'

function idsFrom(value: unknown): number[] {
  const source = value && typeof value === 'object' && 'data' in value ? (value as { data: unknown }).data : value
  return Array.isArray(source) ? source.map(Number).filter(Number.isInteger) : []
}

export function parseRouteSystemIds(value: string): number[] {
  return [...new Set(value.split(/[\s,;>]+/).map(Number).filter(Number.isInteger))]
}

export async function fetchIgnoredSystems(api: EveMercApi): Promise<number[]> {
  const { data, error } = await api.GET('/api/v1/ignore-systems')
  if (error) throw new Error('Could not load ignored systems.')
  return idsFrom(data)
}

export async function addIgnoredSystem(api: EveMercApi, systemId: number): Promise<number[]> {
  const { data, error } = await api.POST('/api/v1/ignore-systems', { body: { solarsystem_id: systemId } })
  if (error) throw new Error('Could not ignore the selected system.')
  return idsFrom(data)
}

export async function removeIgnoredSystem(api: EveMercApi, systemId: number): Promise<number[]> {
  const { data, error } = await api.DELETE('/api/v1/ignore-system/{solarsystem_id}', {
    params: { path: { solarsystem_id: String(systemId) } },
  })
  if (error) throw new Error('Could not remove the selected system from the ignore list.')
  return idsFrom(data)
}

export async function sendRouteWaypoints(api: EveMercApi, systemIds: number[]): Promise<number> {
  let characterCount = 0
  for (const [index, destinationId] of systemIds.entries()) {
    const { data, error } = await api.POST('/api/v1/waypoints/bulk', {
      body: {
        destination_id: destinationId,
        clear_other_waypoints: index === 0,
        add_to_beginning: false,
      },
    })
    if (error) throw new Error(`Route stopped at solar system ${destinationId}.`)
    const payload = data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data
    if (payload && typeof payload === 'object' && 'character_count' in payload) {
      characterCount = Number((payload as { character_count: unknown }).character_count) || characterCount
    }
  }
  return characterCount
}
