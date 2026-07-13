import type { RegionalLayerContext, RegionalLayerData } from '../types'

export async function loadKillActivityLayer(context: RegionalLayerContext): Promise<RegionalLayerData> {
  const { data, error, response } = await context.api.GET('/api/v1/maps/{map_slug}/region/{id}', {
    params: { path: { map_slug: context.mapSlug, id: String(context.regionId) } },
  })
  if (error || !data?.systems) {
    throw new Error(`Regional intel request failed with HTTP ${response.status}.`)
  }

  const indicators: RegionalLayerData['indicators'] = {}
  const killCounts: NonNullable<RegionalLayerData['killCounts']> = {}
  for (const system of data.systems) {
    if (typeof system.id !== 'number') continue
    const shipKills = system.kill_stats?.ship_kills ?? 0
    const podKills = system.kill_stats?.pod_kills ?? 0
    const npcKills = system.kill_stats?.npc_kills ?? 0
    const kills = shipKills + podKills

    if (kills > 0) {
      indicators[system.id] = {
        intensity: Math.min(1, Math.log2(kills + 1) / 6),
        label: `${kills} player kills / 24h`,
        color: '#fb7185',
      }
    }
    if (shipKills > 0 || npcKills > 0) {
      killCounts[system.id] = { shipKills, npcKills }
    }
  }

  return { layerId: 'kill-activity', indicators, killCounts }
}
