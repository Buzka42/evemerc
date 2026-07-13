import { describe, expect, it, vi } from 'vitest'

import { createEveMercApi, MemoryAccessTokenStore } from './client'

describe('EveMerc API client', () => {
  it('adds the desktop bearer token to authenticated requests', async () => {
    const tokenStore = new MemoryAccessTokenStore()
    await tokenStore.set('desktop-token')
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }))
    const client = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore, fetch })

    await client.GET('/api/maps')

    const request = fetch.mock.calls[0]?.[0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).headers.get('Authorization')).toBe('Bearer desktop-token')
    expect((request as Request).headers.get('Accept')).toBe('application/json')
  })

  it('clears an invalid token after an unauthorized response', async () => {
    const tokenStore = new MemoryAccessTokenStore()
    await tokenStore.set('expired-token')
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 401 }))
    const client = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore, fetch })

    await client.GET('/api/v1/me')

    expect(await tokenStore.get()).toBeNull()
  })

  it('uses generated request and response types for location observations', async () => {
    const tokenStore = new MemoryAccessTokenStore()
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 101,
      character_id: 90000001,
      solar_system_id: 30000142,
      state: 'in_transit',
      source: 'eve_gamelog',
      observed_at: '2026-07-12T20:00:00.000000Z',
      applied: true,
      revision: 8,
    }), { headers: { 'Content-Type': 'application/json' }, status: 201 }))
    const client = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore, fetch })

    const { data, response } = await client.POST('/api/v1/location-observations', {
      body: {
        character_id: 90000001,
        solar_system_id: 30000142,
        observed_at: '2026-07-12T20:00:00.000000Z',
        state: 'in_transit',
        source_event_id: 'a'.repeat(64),
      },
    })

    expect(response.status).toBe(201)
    expect(data?.revision).toBe(8)
  })
})
