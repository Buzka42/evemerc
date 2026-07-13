import { describe, expect, it } from 'vitest'
import { normalizeSystemIntel } from './system'

describe('system intel normalization', () => {
  it('normalizes operational counters and tolerates unavailable feeds', () => {
    expect(normalizeSystemIntel(30, { jumps: 14 }, { player_kills_24h: 3, npc_kills_24h: 8, total_24h: 11 }, [{}, {}], [{}])).toEqual({
      systemId: 30,
      jumps: 14,
      playerKills24h: 3,
      npcKills24h: 8,
      totalKills24h: 11,
      recentKills: 2,
      sovereigntyStructures: 1,
    })
  })
})
