import type { EveMercApi } from '../api/client'

export type FleetKill = {
  id: number
  time: string | null
  involvement: 'kill' | 'loss'
  victimName: string
  victimShip: string
  finalBlowName: string | null
  attackerCount: number
  value: number | null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function normalizeFleetKills(value: unknown): FleetKill[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    const kill = record(item)
    const id = Number(kill.killmail_id)
    if (!Number.isInteger(id)) return []
    const victim = record(kill.victim)
    const finalBlow = record(kill.final_blow)
    const zkb = record(kill.zkb)

    return [{
      id,
      time: typeof kill.killmail_time === 'string' ? kill.killmail_time : null,
      involvement: kill.fleet_involvement === 'loss' ? 'loss' as const : 'kill' as const,
      victimName: String(victim.character_name ?? victim.corporation_name ?? 'Unknown victim'),
      victimShip: String(victim.ship_type_name ?? 'Unknown ship'),
      finalBlowName: typeof finalBlow.character_name === 'string' ? finalBlow.character_name : null,
      attackerCount: Number.isFinite(Number(kill.attacker_count)) ? Number(kill.attacker_count) : 0,
      value: Number.isFinite(Number(zkb.totalValue)) ? Number(zkb.totalValue) : null,
    }]
  })
}

export async function fetchFleetKills(api: EveMercApi, mapSlug: string): Promise<FleetKill[]> {
  const { data, error } = await api.GET('/api/v1/maps/{map_slug}/fleet-kills', {
    params: { path: { map_slug: mapSlug } },
  })
  if (error) throw new Error('Could not load the fleet killfeed.')
  return normalizeFleetKills(data)
}

export function zkillUrl(killId: number): string {
  return `https://zkillboard.com/kill/${killId}/`
}
