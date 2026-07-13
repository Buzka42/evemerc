import { describe, expect, it, vi } from 'vitest'

import { createEveMercApi, MemoryAccessTokenStore } from '../../api/client'
import { loadSovereigntyLayer, normalizeSovereigntyRing } from './sovereignty'

describe('sovereignty overlay normalization', () => {
  it('reads the id-keyed object response, preferring alliance over corporation over faction', () => {
    const rings = normalizeSovereigntyRing({
      30000142: { id: 30000142, alliance: { id: 1, name: 'Test Alliance', ticker: 'TEST' }, corporation: null, faction: null },
      30000144: { id: 30000144, alliance: null, corporation: { id: 2, name: 'Some Corp', ticker: 'SC' }, faction: null },
      30000145: { id: 30000145, alliance: null, corporation: null, faction: null },
    })

    expect(rings[30000142]).toEqual({ label: 'Test Alliance [TEST]', color: expect.stringMatching(/^hsl\(/) })
    expect(rings[30000144]).toEqual({ label: 'Some Corp [SC]', color: expect.stringMatching(/^hsl\(/) })
    expect(rings[30000145]).toBeUndefined()
  })

  it('returns an empty object for a malformed or array-shaped payload', () => {
    expect(normalizeSovereigntyRing(null)).toEqual({})
    expect(normalizeSovereigntyRing([])).toEqual({})
  })

  it('assigns the same color to the same holder across systems', () => {
    const rings = normalizeSovereigntyRing({
      30000142: { alliance: { name: 'Test Alliance', ticker: 'TEST' } },
      30000144: { alliance: { name: 'Test Alliance', ticker: 'TEST' } },
    })
    expect(rings[30000142]?.color).toBe(rings[30000144]?.color)
  })
})

describe('loadSovereigntyLayer', () => {
  it('contributes a sovereignty overlay through the public regional layer contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      30000142: { id: 30000142, alliance: { id: 1, name: 'Test Alliance', ticker: 'TEST' } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore: new MemoryAccessTokenStore(), fetch })

    const layer = await loadSovereigntyLayer(api)

    expect(layer.layerId).toBe('sovereignty')
    expect(layer.rings?.[30000142]?.label).toBe('Test Alliance [TEST]')
  })
})
