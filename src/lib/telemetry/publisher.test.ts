import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEveMercApi, MemoryAccessTokenStore } from '../api/client'
import { resolveSolarSystem } from '../sde/bridge'
import { publishEveLogObservation } from './publisher'

vi.mock('../sde/bridge', () => ({ resolveSolarSystem: vi.fn() }))

const observation = {
  kind: 'jump_started' as const,
  observedAt: '2026-07-12T20:00:00Z',
  characterId: 90000001,
  fromSystem: 'Perimeter',
  toSystem: 'Jita',
  sourceEventId: 'a'.repeat(64),
}

beforeEach(() => vi.clearAllMocks())

describe('EVE log observation publisher', () => {
  it('resolves the destination locally and uploads only normalized data', async () => {
    vi.mocked(resolveSolarSystem).mockResolvedValue(30000142)
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}', {
      headers: { 'Content-Type': 'application/json' },
      status: 201,
    }))
    const api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore: new MemoryAccessTokenStore(), fetch })
    const onResolved = vi.fn()

    await expect(publishEveLogObservation(api, observation, onResolved)).resolves.toBe(true)
    expect(onResolved).toHaveBeenCalledWith(30000142)

    const request = fetch.mock.calls[0]?.[0] as Request
    const body = await request.json()
    expect(body).toEqual({
      character_id: 90000001,
      solar_system_id: 30000142,
      observed_at: observation.observedAt,
      state: 'in_transit',
      source_event_id: observation.sourceEventId,
    })
    expect(JSON.stringify(body)).not.toContain('Jita')
  })

  it('does not upload unbound sessions or unresolved systems', async () => {
    const api = createEveMercApi({
      baseUrl: 'https://wormhole.systems',
      tokenStore: new MemoryAccessTokenStore(),
      fetch: vi.fn<typeof globalThis.fetch>(),
    })

    await expect(publishEveLogObservation(api, { ...observation, characterId: null })).resolves.toBe(false)
    vi.mocked(resolveSolarSystem).mockResolvedValue(null)
    await expect(publishEveLogObservation(api, observation)).resolves.toBe(false)
  })
})
