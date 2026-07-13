import { describe, expect, it } from 'vitest'
import { filterPaletteCommands } from './palette'

describe('command palette', () => {
  it('finds commands by title and operational keyword', () => {
    expect(filterPaletteCommands('wormhole').map(({ id }) => id)).toContain('layout-scanning')
    expect(filterPaletteCommands('overlay').map(({ id }) => id)).toEqual([
      'layout-compact-fleet',
      'popout-fleet',
      'popout-chain',
      'popout-account',
      'popout-telemetry',
    ])
  })
})
