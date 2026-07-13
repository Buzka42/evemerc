import type { RegionalLayerContext, RegionalLayerData } from '../types'

export async function loadKillActivityLayer(context: RegionalLayerContext): Promise<RegionalLayerData> {
  const { data, error, response } = await context.api.GET('/api/v1/maps/{map_slug}/region/{id}', {
    params: { path: { map_slug: context.mapSlug, id: String(context.regionId) } },
  })
  if (error || !data?.systems) {
    throw new Error(`Regional intel request failed with HTTP ${response.status}.`)
  }

  const indicators: RegionalLayerData['indicators'] = {}
  for (const system of data.systems) {
    const kills = (system.kill_stats?.ship_kills ?? 0) + (system.kill_stats?.pod_kills ?? 0)
    if (typeof system.id === 'number' && kills > 0) {
      indicators[system.id] = {
        intensity: Math.min(1, Math.log2(kills + 1) / 6),
        label: `${kills} player kills / 24h`,
        color: '#fb7185',
      }
    }
  }

  return { layerId: 'kill-activity', indicators }
}
