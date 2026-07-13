import { describe, expect, it, vi } from 'vitest'

import { createEveMercApi, MemoryAccessTokenStore } from '../api/client'
import { fetchChainSnapshot } from './api'

describe('wormhole chain API', () => {
  it('normalizes the complete map contract for chain rendering', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      id: 1,
      slug: 'operations-1',
      map_solarsystems: [{
        id: 10,
        solarsystem_id: 31000005,
        alias: 'Home',
        status: 'scanned',
        position: { x: 100, y: 120 },
        signatures: [{ id: 100, signature_id: 'ABC-123', raw_type_name: 'Unresolved' }],
      }],
      map_connections: [{
        id: 20,
        from_map_solarsystem_id: 10,
        to_map_solarsystem_id: 11,
        mass_status: 'fresh',
        lifetime_status: 'healthy',
      }],
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore: new MemoryAccessTokenStore(), fetch })

    const snapshot = await fetchChainSnapshot(api, 'operations-1')

    expect(snapshot.systems[0]).toMatchObject({ id: 10, solarsystemId: 31000005, alias: 'Home' })
    expect(snapshot.connections[0]).toMatchObject({ id: 20, massStatus: 'fresh' })
  })
})
