import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './check'

describe('desktop release comparison', () => {
  it('compares semantic version components numerically', () => {
    expect(isNewerVersion('1.0.0', '0.10.9')).toBe(true)
    expect(isNewerVersion('0.10.10', '0.10.9')).toBe(true)
    expect(isNewerVersion('0.10.9', '0.10.9')).toBe(false)
    expect(isNewerVersion('0.9.9', '0.10.0')).toBe(false)
  })
})
