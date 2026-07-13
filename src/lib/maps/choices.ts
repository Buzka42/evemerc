import type { EveMercApi } from '../api/client'

export interface MapChoice {
  id: number
  name: string
  slug: string
  defaultRegionId: number | null
}

export function mapChoicesFromApi(data: unknown): MapChoice[] {
  const rows = Array.isArray(data) ? data : []

  return rows.flatMap((value) => {
    const map = value as { id?: unknown; name?: unknown; slug?: unknown; default_region_id?: unknown }
    if (typeof map.id !== 'number' || typeof map.name !== 'string' || typeof map.slug !== 'string') {
      return []
    }

    return [{
      id: map.id,
      name: map.name,
      slug: map.slug,
      defaultRegionId: typeof map.default_region_id === 'number' ? map.default_region_id : null,
    }]
  })
}

export async function fetchMapChoices(api: EveMercApi): Promise<MapChoice[]> {
  const result = await api.GET('/api/v1/maps')

  if (result.error || !result.data?.data) {
    throw new Error(`Map request failed with HTTP ${result.response.status}.`)
  }

  return mapChoicesFromApi(result.data.data)
}
