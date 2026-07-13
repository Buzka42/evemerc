import { describe, expect, it } from 'vitest'
import { normalizeSelectedSystemDetails } from './api'

describe('map audit normalization', () => {
  it('retains actor and value changes for selected-system activity', () => {
    expect(normalizeSelectedSystemDetails({ data: { id: 5, audits: [{ id: 7, event: 'updated', character: { name: 'Scout' }, old_values: { status: 'new' }, new_values: { status: 'scanned' }, created_at: 'now' }] } })).toEqual({
      id: 5,
      audits: [{ id: 7, event: 'updated', characterName: 'Scout', oldValues: { status: 'new' }, newValues: { status: 'scanned' }, createdAt: 'now' }],
    })
  })
})
