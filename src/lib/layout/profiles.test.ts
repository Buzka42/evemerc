import { describe, expect, it } from 'vitest'
import { defaultLayoutProfiles, panelVisible, parseLayoutProfiles, resolveVisiblePanels } from './profiles'

describe('layout profiles', () => {
  it('keeps fleet command visible in every built-in profile', () => {
    expect(defaultLayoutProfiles.every((profile) => panelVisible(profile, 'fleet-command'))).toBe(true)
  })

  it('rejects corrupt or fleetless saved layouts', () => {
    expect(parseLayoutProfiles('{broken')).toBe(defaultLayoutProfiles)
    expect(parseLayoutProfiles(JSON.stringify([{ id: 'bad', name: 'Bad', panels: [] }]))).toBe(defaultLayoutProfiles)
  })
})

describe('resolveVisiblePanels', () => {
  const profile = defaultLayoutProfiles[0]

  it('includes every profile-visible panel when all owning modules are enabled', () => {
    expect(resolveVisiblePanels(profile, () => true)).toEqual(['fleet-command', 'wormhole-chain', 'account', 'telemetry'])
  })

  it('drops a panel whose owning module is disabled, even though the profile marks it visible', () => {
    const panels = resolveVisiblePanels(profile, (moduleId) => moduleId !== 'wormhole-map')
    expect(panels).toEqual(['fleet-command', 'account', 'telemetry'])
  })

  it('never drops shell panels with no owning module regardless of module state', () => {
    const panels = resolveVisiblePanels(profile, () => false)
    expect(panels).toEqual(['account', 'telemetry'])
  })

  it('still honors profile-level visibility before module gating', () => {
    const compact = defaultLayoutProfiles.find((candidate) => candidate.id === 'compact-fleet')!
    expect(resolveVisiblePanels(compact, () => true)).toEqual(['fleet-command', 'telemetry'])
  })
})
