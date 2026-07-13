import { memberFreshness } from './freshness'
import type { FleetSnapshot } from './status'

export interface FleetAlert {
  id: string
  severity: 'warning' | 'critical'
  title: string
  characterId: number | null
  solarSystemId: number | null
}

export function fleetAlerts(snapshot: FleetSnapshot, now = Date.now()): FleetAlert[] {
  return snapshot.members.flatMap((member) => {
    const characterId = member.character_id ?? null
    const solarSystemId = member.solar_system_id ?? null
    const name = member.character_name ?? `Pilot ${characterId ?? 'unknown'}`
    const alerts: FleetAlert[] = []
    const freshness = memberFreshness(member, now, snapshot.freshness.staleAfterSeconds)

    if (freshness.state === 'stale') {
      alerts.push({ id: `stale-${characterId}`, severity: 'warning', title: `${name} position is stale`, characterId, solarSystemId })
    }
    if (solarSystemId === null) {
      alerts.push({ id: `unknown-${characterId}`, severity: 'critical', title: `${name} location is unknown`, characterId, solarSystemId })
    }
    if (member.location_state === 'uncertain') {
      alerts.push({ id: `conflict-${characterId}`, severity: 'critical', title: `${name} has conflicting location evidence`, characterId, solarSystemId })
    }
    if (member.online === false) {
      alerts.push({ id: `offline-${characterId}`, severity: 'warning', title: `${name} is offline`, characterId, solarSystemId })
    }

    return alerts
  })
}
