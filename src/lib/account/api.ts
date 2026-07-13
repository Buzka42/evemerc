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
