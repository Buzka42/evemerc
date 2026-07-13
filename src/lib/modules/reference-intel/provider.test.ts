import { describe, expect, it, vi } from 'vitest'

import { createEveMercApi, MemoryAccessTokenStore } from '../../api/client'
import { loadKillActivityLayer } from './provider'

describe('reference intel provider', () => {
  it('contributes a kill overlay through the public regional layer contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      region_id: 10000002,
      region_name: 'The Forge',
      systems: [
        { id: 30000142, kill_stats: { ship_kills: 8, pod_kills: 2, npc_kills: 5 } },
        { id: 30000144, kill_stats: null },
      ],
      connections: [],
      fleet_active: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore: new MemoryAccessTokenStore(), fetch })

    const layer = await loadKillActivityLayer({ api, mapSlug: 'operations-1', regionId: 10000002 })

    expect(layer.layerId).toBe('kill-activity')
    expect(layer.indicators[30000142]?.label).toBe('10 player kills / 24h')
    expect(layer.indicators[30000144]).toBeUndefined()
    expect(layer.killCounts?.[30000142]).toEqual({ shipKills: 8, npcKills: 5 })
    expect(layer.killCounts?.[30000144]).toBeUndefined()
  })
})
