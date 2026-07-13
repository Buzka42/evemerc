import { describe, expect, it } from 'vitest'
import { normalizeMapAccess } from './access'

describe('map access normalization', () => {
  it('normalizes candidates and entries with access, including revoked (null-permission) entries', () => {
    expect(normalizeMapAccess({
      data: {
        entities: [
          { id: 1, name: 'Arawn', type: 'character', permission: 'manager', is_owner: true },
          { id: 2, name: 'Some Corp', type: 'corporation', permission: null, is_owner: false },
        ],
        entities_with_access: [
          { id: 1, name: 'Arawn', type: 'character', permission: 'manager', is_owner: true, expires_at: null },
          { id: 3, name: 'Some Alliance', type: 'alliance', permission: 'viewer', is_owner: false, expires_at: '2052-08-05T00:00:00Z' },
        ],
      },
    })).toEqual({
      candidates: [
        { id: 1, name: 'Arawn', type: 'character', permission: 'manager', isOwner: true },
        { id: 2, name: 'Some Corp', type: 'corporation', permission: null, isOwner: false },
      ],
      entries: [
        { id: 1, name: 'Arawn', type: 'character', permission: 'manager', isOwner: true, expiresAt: null },
        { id: 3, name: 'Some Alliance', type: 'alliance', permission: 'viewer', isOwner: false, expiresAt: '2052-08-05T00:00:00Z' },
      ],
    })
  })

  it('returns empty lists for a malformed or missing payload', () => {
    expect(normalizeMapAccess(null)).toEqual({ candidates: [], entries: [] })
    expect(normalizeMapAccess({ data: {} })).toEqual({ candidates: [], entries: [] })
  })
})
