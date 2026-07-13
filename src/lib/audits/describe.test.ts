import { describe, expect, it } from 'vitest'
import { describeAudit } from './describe'
import type { MapAuditEntry } from './api'

function audit(overrides: Partial<MapAuditEntry>): MapAuditEntry {
  return {
    id: 1,
    event: 'updated',
    characterName: 'Arawn',
    createdAt: null,
    oldValues: {},
    newValues: {},
    ...overrides,
  }
}

describe('describeAudit', () => {
  it('describes creation', () => {
    expect(describeAudit(audit({ event: 'created' }))).toBe('Arawn added this system to the map.')
  })

  it('describes deletion', () => {
    expect(describeAudit(audit({ event: 'deleted' }))).toBe('Arawn removed this system from the map.')
  })

  it('describes a status change with a from/to sentence', () => {
    const result = describeAudit(audit({ oldValues: { status: 'active' }, newValues: { status: 'empty' } }))
    expect(result).toBe('Arawn changed status from "active" to "empty".')
  })

  it('describes setting a previously-empty alias', () => {
    const result = describeAudit(audit({ oldValues: { alias: null }, newValues: { alias: 'Staging' } }))
    expect(result).toBe('Arawn set alias to "Staging".')
  })

  it('describes clearing a field', () => {
    const result = describeAudit(audit({ oldValues: { notes: 'watch this' }, newValues: { notes: null } }))
    expect(result).toBe('Arawn cleared notes.')
  })

  it('combines multiple field changes into one sentence', () => {
    const result = describeAudit(audit({
      oldValues: { status: 'active', pinned: false },
      newValues: { status: 'empty', pinned: true },
    }))
    expect(result).toBe('Arawn changed status from "active" to "empty", changed pin from "no" to "yes".')
  })

  it('ignores position-only changes and falls back to a move sentence', () => {
    const result = describeAudit(audit({ oldValues: { position_x: 10 }, newValues: { position_x: 40 } }))
    expect(result).toBe('Arawn moved this system.')
  })

  it('falls back to "The system" when no character is attributed', () => {
    const result = describeAudit(audit({ event: 'created', characterName: null }))
    expect(result).toBe('The system added this system to the map.')
  })
})
