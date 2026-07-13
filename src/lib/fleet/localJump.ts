import type { FleetSnapshot } from './status'

export function applyLocalJump(
  snapshot: FleetSnapshot,
  characterId: number,
  solarSystemId: number,
  observedAt: string,
): FleetSnapshot {
  return applyLocationObservation(snapshot, characterId, solarSystemId, observedAt, 'eve_gamelog', 'in_transit')
}

export function applyLocationObservation(
  snapshot: FleetSnapshot,
  characterId: number,
  solarSystemId: number,
  observedAt: string,
  source: string,
  state: 'confirmed' | 'in_transit' | 'uncertain',
): FleetSnapshot {
  return {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    members: snapshot.members.map((member) => member.character_id === characterId
      ? {
          ...member,
          solar_system_id: solarSystemId,
          observed_at: observedAt,
          source,
          location_state: state,
        }
      : member),
  }
}
