import type { EveMercApi } from '../api/client'
import { resolveSolarSystem } from '../sde/bridge'
import type { EveLogObservation } from './eveLogs'

export async function publishEveLogObservation(
  api: EveMercApi,
  observation: EveLogObservation,
  onResolved?: (solarSystemId: number) => void,
): Promise<boolean> {
  if (observation.kind !== 'jump_started' || observation.characterId === null) {
    return false
  }

  const solarSystemId = await resolveSolarSystem(observation.toSystem)
  if (solarSystemId === null) {
    return false
  }
  onResolved?.(solarSystemId)

  const { error, response } = await api.POST('/api/v1/location-observations', {
    body: {
      character_id: observation.characterId,
      solar_system_id: solarSystemId,
      observed_at: observation.observedAt,
      state: 'in_transit',
      source_event_id: observation.sourceEventId,
    },
  })

  if (response.status === 409) {
    return false
  }
  if (error) {
    throw new Error(`Location observation upload failed with HTTP ${response.status}.`)
  }

  return true
}
