import type { EveMercApi } from '../api/client'

export interface SystemIntel {
  systemId: number
  jumps: number
  playerKills24h: number | null
  npcKills24h: number | null
  totalKills24h: number | null
  recentKills: number
  sovereigntyStructures: number
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

export function normalizeSystemIntel(
  systemId: number,
  jumpsData: unknown,
  statsData: unknown,
  killsData: unknown,
  structuresData: unknown,
): SystemIntel {
  const jumps = typeof jumpsData === 'object' && jumpsData !== null ? numberOrNull((jumpsData as Record<string, unknown>).jumps) : null
  const stats = typeof statsData === 'object' && statsData !== null ? statsData as Record<string, unknown> : {}

  return {
    systemId,
    jumps: jumps ?? 0,
    playerKills24h: numberOrNull(stats.player_kills_24h),
    npcKills24h: numberOrNull(stats.npc_kills_24h),
    totalKills24h: numberOrNull(stats.total_24h),
    recentKills: Array.isArray(killsData) ? killsData.length : 0,
    sovereigntyStructures: Array.isArray(structuresData) ? structuresData.length : 0,
  }
}

export async function fetchSystemIntel(api: EveMercApi, systemId: number): Promise<SystemIntel> {
  const pathSystemId = String(systemId)
  const [jumps, stats, kills, structures] = await Promise.all([
    api.GET('/api/v1/system/{solarsystemId}/jumps', { params: { path: { solarsystemId: pathSystemId } } }),
    api.GET('/api/v1/system/{solarsystemId}/stats24h', { params: { path: { solarsystemId: pathSystemId } } }),
    api.GET('/api/v1/zkillboard/system/{solarsystemId}/kills', { params: { path: { solarsystemId: pathSystemId } } }),
    api.GET('/api/v1/system/{solarsystemId}/sov-structures', { params: { path: { solarsystemId: pathSystemId } } }),
  ])

  if (jumps.error || stats.error || kills.error || structures.error) {
    throw new Error('Unable to load the selected system intel.')
  }

  return normalizeSystemIntel(systemId, jumps.data, stats.data, kills.data, structures.data)
}
