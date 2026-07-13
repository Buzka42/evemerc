import { describe, expect, it } from 'vitest'
import { mapChoicesFromApi } from './choices'

describe('map choice normalization', () => {
  it('keeps only valid maps and normalizes an absent default region', () => {
    expect(mapChoicesFromApi([
      { id: 3, name: 'Home Chain', slug: 'home-chain', default_region_id: 10000002 },
      { id: 4, name: 'No Default Region', slug: 'no-default' },
      { name: 'missing id', slug: 'no-id' },
    ])).toEqual([
      { id: 3, name: 'Home Chain', slug: 'home-chain', defaultRegionId: 10000002 },
      { id: 4, name: 'No Default Region', slug: 'no-default', defaultRegionId: null },
    ])
  })

  it('returns an empty list for a non-array payload', () => {
    expect(mapChoicesFromApi(null)).toEqual([])
    expect(mapChoicesFromApi(undefined)).toEqual([])
    expect(mapChoicesFromApi({ data: [] })).toEqual([])
  })
})
