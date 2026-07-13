import { describe, expect, it, vi } from 'vitest'

import { createEveMercApi, MemoryAccessTokenStore } from '../api/client'
import { setFleetWaypoint } from './actions'

describe('fleet command actions', () => {
  it('uses the generated v1 contract and returns waypoint reach', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      message: 'Fleet destination set successfully.',
      data: { destination_id: 30000142, destination_name: 'Jita', character_count: 12 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore: new MemoryAccessTokenStore(), fetch })

    await expect(setFleetWaypoint(api, 'operations-1', 30000142)).resolves.toEqual({
      destinationName: 'Jita',
      characterCount: 12,
    })

    const request = fetch.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('https://wormhole.systems/api/v1/maps/operations-1/fleet/waypoint')
  })
})
