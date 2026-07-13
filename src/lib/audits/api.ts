import type { EveMercApi } from '../api/client'

export interface MapAuditEntry {
  id: number
  event: string
  characterName: string | null
  createdAt: string | null
  oldValues: Record<string, unknown>
  newValues: Record<string, unknown>
}

export interface SelectedSystemDetails {
  id: number
  audits: MapAuditEntry[]
}

export function normalizeSelectedSystemDetails(payload: unknown): SelectedSystemDetails | null {
  if (typeof payload !== 'object' || payload === null) return null
  const wrapper = payload as { data?: unknown }
  if (typeof wrapper.data !== 'object' || wrapper.data === null) return null
  const system = wrapper.data as Record<string, unknown>
  if (typeof system.id !== 'number') return null
  const audits = Array.isArray(system.audits) ? system.audits.flatMap((value) => {
    const audit = value as Record<string, unknown>
    if (typeof audit.id !== 'number' || typeof audit.event !== 'string') return []
    const character = typeof audit.character === 'object' && audit.character !== null
      ? audit.character as Record<string, unknown>
      : null
    return [{
      id: audit.id,
      event: audit.event,
      characterName: typeof character?.name === 'string' ? character.name : null,
      createdAt: typeof audit.created_at === 'string' ? audit.created_at : null,
      oldValues: typeof audit.old_values === 'object' && audit.old_values !== null ? audit.old_values as Record<string, unknown> : {},
      newValues: typeof audit.new_values === 'object' && audit.new_values !== null ? audit.new_values as Record<string, unknown> : {},
    }]
  }) : []

  return { id: system.id, audits }
}

export async function fetchSelectedSystemDetails(api: EveMercApi, mapSolarsystemId: number): Promise<SelectedSystemDetails> {
  const { data, error } = await api.GET('/api/v1/map-solarsystems/{id}', {
    params: { path: { id: mapSolarsystemId } },
  })
  const details = normalizeSelectedSystemDetails(data)
  if (error || !details) throw new Error('Unable to load the selected system activity.')
  return details
}
