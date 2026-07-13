import type { EveMercApi } from '../../api/client'
import type { RegionalLayerData } from '../types'

interface SovereigntyOwner {
  id?: number
  name?: string
  ticker?: string
}

interface SovereigntyRow {
  id?: number
  alliance?: SovereigntyOwner | null
  corporation?: SovereigntyOwner | null
  faction?: SovereigntyOwner | null
}

/** Deterministic hue from a name/ticker so the same holder always gets the same ring color, without a hardcoded palette. */
function colorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 70% 60%)`
}

/**
 * The backend response is a JSON object keyed by solarsystem_id (`{ "30000142": {...} }`),
 * not an array - verified from SovereigntyController@index's `mapWithKeys()` call, since
 * schema.d.ts under-documents this operation's response as `Record<string, never>[]`.
 */
export function normalizeSovereigntyRing(value: unknown): Record<number, { label: string; color: string }> {
  const rows = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const rings: Record<number, { label: string; color: string }> = {}

  for (const [key, raw] of Object.entries(rows)) {
    const systemId = Number(key)
    if (!Number.isFinite(systemId)) continue
    const row = raw as SovereigntyRow
    const holder = row.alliance ?? row.corporation ?? row.faction
    if (!holder?.name) continue

    const label = holder.ticker ? `${holder.name} [${holder.ticker}]` : holder.name
    rings[systemId] = { label, color: colorFor(holder.ticker ?? holder.name) }
  }

  return rings
}

export async function loadSovereigntyLayer(api: EveMercApi): Promise<RegionalLayerData> {
  const get = api.GET as unknown as (path: '/api/v1/sovereignties') => Promise<{ data?: unknown; error?: unknown }>
  const { data, error } = await get('/api/v1/sovereignties')
  if (error) throw new Error('Could not load sovereignty data.')

  return { layerId: 'sovereignty', indicators: {}, rings: normalizeSovereigntyRing(data) }
}
