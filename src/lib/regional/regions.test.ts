import { describe, expect, it, vi } from 'vitest'

import { createEveMercApi, MemoryAccessTokenStore } from '../api/client'
import { fetchRegions } from './regions'

describe('fetchRegions', () => {
  it('normalizes the bare region array response', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify([
      { id: 10000002, name: 'The Forge' },
      { id: 10000001, name: 'Derelik' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore: new MemoryAccessTokenStore(), fetch })

    const regions = await fetchRegions(api)

    expect(regions).toEqual([{ id: 10000002, name: 'The Forge' }, { id: 10000001, name: 'Derelik' }])
  })

  it('drops malformed rows and tolerates a non-array payload', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify([
      { id: 10000002, name: 'The Forge' },
      { id: 'bad', name: 'Broken' },
      { name: 'No id' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore: new MemoryAccessTokenStore(), fetch })

    expect(await fetchRegions(api)).toEqual([{ id: 10000002, name: 'The Forge' }])
  })
})
