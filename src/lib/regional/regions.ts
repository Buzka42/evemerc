import type { EveMercApi } from '../api/client'

export interface RegionChoice {
  id: number
  name: string
}

function regionsFrom(value: unknown): RegionChoice[] {
  const rows = Array.isArray(value) ? value : []
  return rows.flatMap((row) => {
    const record = row as { id?: unknown; name?: unknown }
    return typeof record.id === 'number' && typeof record.name === 'string' ? [{ id: record.id, name: record.name }] : []
  })
}

/**
 * `GET /api/v1/regions` for the region-selector dropdown (PLAN.md M-regional). schema.d.ts only
 * documents this operation's 500-error response - Scribe never captured a success example - so
 * the generated type is bypassed here. Verified the real success shape by reading
 * RegionalMapController::regions() directly: a bare `[{id, name}, ...]` array, sorted by name.
 */
export async function fetchRegions(api: EveMercApi): Promise<RegionChoice[]> {
  const get = api.GET as unknown as (path: '/api/v1/regions') => Promise<{ data?: unknown; error?: unknown }>
  const { data, error } = await get('/api/v1/regions')
  if (error) throw new Error('Could not load the region list.')
  return regionsFrom(data)
}
