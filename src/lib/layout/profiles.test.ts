import { describe, expect, it } from 'vitest'
import { defaultLayoutProfiles, panelVisible, parseLayoutProfiles } from './profiles'

describe('layout profiles', () => {
  it('keeps fleet command visible in every built-in profile', () => {
    expect(defaultLayoutProfiles.every((profile) => panelVisible(profile, 'fleet-command'))).toBe(true)
  })

  it('rejects corrupt or fleetless saved layouts', () => {
    expect(parseLayoutProfiles('{broken')).toBe(defaultLayoutProfiles)
    expect(parseLayoutProfiles(JSON.stringify([{ id: 'bad', name: 'Bad', panels: [] }]))).toBe(defaultLayoutProfiles)
  })
})
