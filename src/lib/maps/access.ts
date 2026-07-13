import type { EveMercApi } from '../api/client'

export type EntityType = 'character' | 'corporation' | 'alliance'
export type MapPermission = 'viewer' | 'member' | 'manager'

export interface AccessCandidate {
  id: number
  name: string
  type: EntityType
  permission: MapPermission | null
  isOwner: boolean
}

export interface MapAccessEntry extends AccessCandidate {
  expiresAt: string | null
}

export interface MapAccessList {
  candidates: AccessCandidate[]
  entries: MapAccessEntry[]
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asEntityType(value: unknown): EntityType {
  return value === 'corporation' || value === 'alliance' ? value : 'character'
}

function asPermission(value: unknown): MapPermission | null {
  return value === 'viewer' || value === 'member' || value === 'manager' ? value : null
}

function candidateFrom(value: unknown): AccessCandidate | null {
  const row = record(value)
  if (typeof row.id !== 'number' || typeof row.name !== 'string') return null

  return {
    id: row.id,
    name: row.name,
    type: asEntityType(row.type),
    permission: asPermission(row.permission),
    isOwner: row.is_owner === true,
  }
}

/**
 * Normalizes the map access response. Verified against the backend's actual
 * MapAccessController@show + MapAccessEntityResource source (not guessed, and not fully
 * documented in schema.d.ts — the JSON branch returns
 * `{ data: { entities: [...raw candidates], entities_with_access: [...MapAccessEntityResource] } }`.
 * `entities_with_access` is snake_case in the wire response even though everything else this
 * client normalizes to camelCase.
 */
export function normalizeMapAccess(value: unknown): MapAccessList {
  const data = record(record(value).data)
  const candidateRows = Array.isArray(data.entities) ? data.entities : []
  const entryRows = Array.isArray(data.entities_with_access) ? data.entities_with_access : []

  return {
    candidates: candidateRows.flatMap((row) => {
      const candidate = candidateFrom(row)
      return candidate ? [candidate] : []
    }),
    entries: entryRows.flatMap((row) => {
      const candidate = candidateFrom(row)
      if (!candidate) return []
      const expiresAt = record(row).expires_at
      return [{ ...candidate, expiresAt: typeof expiresAt === 'string' ? expiresAt : null }]
    }),
  }
}

export async function fetchMapAccess(api: EveMercApi, mapSlug: string): Promise<MapAccessList> {
  const { data, error } = await api.GET('/api/v1/maps/{map_slug}/access', { params: { path: { map_slug: mapSlug } } })
  if (error) throw new Error('Could not load map access.')
  return normalizeMapAccess(data)
}

/** Setting `permission: null` on an entity that already has access revokes it - there is no separate delete endpoint. */
export async function setMapAccess(
  api: EveMercApi,
  mapSlug: string,
  entityId: number,
  entityType: EntityType,
  permission: MapPermission | null,
  expiresAt: string | null,
): Promise<void> {
  const { error } = await api.POST('/api/v1/maps/{map_slug}/access', {
    params: { path: { map_slug: mapSlug } },
    body: { entity_id: entityId, entity_type: entityType, permission, expires_at: expiresAt },
  })
  if (error) throw new Error('Could not update map access.')
}
