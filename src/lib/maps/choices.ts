import type { EveMercApi } from '../api/client'

export interface MapChoice {
  id: number
  name: string
  slug: string
  defaultRegionId: number | null
}

export async function fetchMapChoices(api: EveMercApi): Promise<MapChoice[]> {
  const result = await api.GET('/api/v1/maps')

  if (result.error || !result.data?.data) {
    throw new Error(`Map request failed with HTTP ${result.response.status}.`)
  }

  return result.data.data.flatMap((map) => {
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
