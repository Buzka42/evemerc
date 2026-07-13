import { describe, expect, it } from 'vitest'
import { parseRouteSystemIds } from './api'

describe('route system input', () => {
  it('accepts comma, whitespace, semicolon, and arrow-separated IDs without duplicates', () => {
    expect(parseRouteSystemIds('30000142 > 30000144, 30000142; 30000145')).toEqual([30000142, 30000144, 30000145])
  })

  it('rejects incomplete and non-numeric route entries', () => {
    expect(parseRouteSystemIds('Jita, 30000142.5, 30000144')).toEqual([30000144])
  })
})
