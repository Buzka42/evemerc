import type { EveMercApi } from '../api/client'

export interface AccountCharacter {
  id: number
  name: string
  esiScopes: string[]
  isPreferred: boolean
  isOnline: boolean
  solarSystemName: string | null
  shipName: string | null
  locationSource: string | null
  locationState: string | null
}

export interface AccountToken {
  id: number
  name: string
  createdAt: string | null
  lastUsedAt: string | null
}

type ApiCharacter = {
  id?: number
  name?: string
  esi_scopes?: string[]
  is_preferred?: boolean
  status?: {
    is_online?: boolean
    solarsystem_name?: string | null
    ship_name?: string | null
    ship_type?: { name?: string | null } | null
    location?: { source?: string | null; state?: string | null }
  } | null
}

function charactersFrom(data: unknown): AccountCharacter[] {
  const rows = Array.isArray(data) ? data : []

  return rows.flatMap((value) => {
    const row = value as ApiCharacter
    return typeof row.id === 'number' && typeof row.name === 'string'
      ? [{
          id: row.id,
          name: row.name,
          esiScopes: row.esi_scopes ?? [],
          isPreferred: row.is_preferred ?? false,
          isOnline: row.status?.is_online ?? false,
          solarSystemName: row.status?.solarsystem_name ?? null,
          shipName: row.status?.ship_type?.name ?? row.status?.ship_name ?? null,
          locationSource: row.status?.location?.source ?? null,
          locationState: row.status?.location?.state ?? null,
        }]
      : []
  })
}

export async function fetchAccountCharacters(api: EveMercApi): Promise<AccountCharacter[]> {
  const { data, error } = await api.GET('/api/v1/account/characters')
  if (error) throw new Error('Unable to load account characters.')

  return charactersFrom(data)
}

export async function setPreferredCharacter(api: EveMercApi, characterId: number): Promise<void> {
  const { error } = await api.PUT('/api/v1/account/characters/{character_id}/preferred', {
    params: { path: { character_id: characterId } },
  })
  if (error) throw new Error('Unable to change the preferred character.')
}

export async function revokeCharacterScopes(api: EveMercApi, characterId: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/account/characters/{character_id}/scopes', {
    params: { path: { character_id: characterId } },
  })
  if (error) throw new Error('Unable to revoke character scopes.')
}

/** Removes a character from the account entirely (not just its ESI scopes). The backend refuses with a 422 if this is the account's last character. */
export async function removeCharacter(api: EveMercApi, characterId: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/user-characters/{character_id}', {
    params: { path: { character_id: characterId } },
  })
  if (error) throw new Error('Unable to remove the character. An account must keep at least one character.')
}

export const accountCharactersFromApi = charactersFrom

function tokensFrom(data: unknown): AccountToken[] {
  const rows = Array.isArray(data) ? data : []
  return rows.flatMap((value) => {
    const row = value as Record<string, unknown>
    return typeof row.id === 'number' && typeof row.name === 'string' ? [{
      id: row.id,
      name: row.name,
      createdAt: typeof row.created_at === 'string' ? row.created_at : null,
      lastUsedAt: typeof row.last_used_at === 'string' ? row.last_used_at : null,
    }] : []
  })
}

export async function fetchAccountTokens(api: EveMercApi): Promise<AccountToken[]> {
  const { data, error } = await api.GET('/api/v1/tokens')
  if (error) throw new Error('Unable to load API tokens.')
  return tokensFrom(data)
}

export async function createAccountToken(api: EveMercApi, name: string): Promise<string> {
  const { data, error } = await api.POST('/api/v1/tokens', { body: { name } })
  const payload: unknown = data
  if (error || typeof payload !== 'object' || payload === null || !('plain_text_token' in payload)) {
    throw new Error('Unable to create the API token.')
  }
  return String(payload.plain_text_token)
}

export async function deleteAccountToken(api: EveMercApi, tokenId: number): Promise<void> {
  const { error } = await api.DELETE('/api/v1/tokens/{id}', { params: { path: { id: tokenId } } })
  if (error) throw new Error('Unable to revoke the API token.')
}

export const accountTokensFromApi = tokensFrom

interface MissingScopeCharacter {
  id: number
  name: string
}

function missingScopesFrom(value: unknown): MissingScopeCharacter[] {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rows = Array.isArray(root.missing_scopes)
    ? root.missing_scopes
    : Array.isArray((root.data as Record<string, unknown> | undefined)?.missing_scopes)
      ? (root.data as { missing_scopes: unknown[] }).missing_scopes
      : []

  return rows.flatMap((row) => {
    const record = row as { id?: unknown; name?: unknown }
    return typeof record.id === 'number' && typeof record.name === 'string' ? [{ id: record.id, name: record.name }] : []
  })
}

/**
 * Characters lacking the ESI scopes tracking needs, per `DesktopAuthController::me()`'s
 * `missing_scopes` field (`doesntHaveTokenWithTrackingScopes()`) - PLAN.md M-tracking calls for
 * porting the web app's `ActiveCharacterWarning`, and this is the backend's own signal for it
 * rather than re-deriving the scope check client-side. `schema.d.ts` only documents this
 * operation's 401 response (no 200 example was ever captured), so the envelope is read
 * defensively rather than trusting a generated type.
 */
export async function fetchMissingScopeCharacters(api: EveMercApi): Promise<MissingScopeCharacter[]> {
  const { data, error } = await api.GET('/api/v1/me')
  if (error) throw new Error('Unable to load account status.')
  return missingScopesFrom(data)
}

export const missingScopeCharactersFromApi = missingScopesFrom
