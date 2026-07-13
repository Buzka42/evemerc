import { describe, expect, it } from 'vitest'
import { accountCharactersFromApi, accountTokensFromApi } from './api'

describe('account character normalization', () => {
  it('keeps only valid characters and normalizes optional account state', () => {
    expect(accountCharactersFromApi([
      { id: 7, name: 'Arawn', esi_scopes: ['esi-location.read_location.v1'], is_preferred: true, status: { is_online: true, solarsystem_name: 'Thera', ship_type: { name: 'Sabre' }, location: { source: 'gamelog', state: 'confirmed' } } },
      { name: 'missing id' },
    ])).toEqual([{
      id: 7,
      name: 'Arawn',
      esiScopes: ['esi-location.read_location.v1'],
      isPreferred: true,
      isOnline: true,
      solarSystemName: 'Thera',
      shipName: 'Sabre',
      locationSource: 'gamelog',
      locationState: 'confirmed',
    }])
  })

  it('normalizes API token metadata without exposing token secrets', () => {
    expect(accountTokensFromApi([{ id: 4, name: 'Overlay', created_at: 'now', last_used_at: null }])).toEqual([{
      id: 4,
      name: 'Overlay',
      createdAt: 'now',
      lastUsedAt: null,
    }])
  })
})
