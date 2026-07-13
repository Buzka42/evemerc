import { describe, expect, it } from 'vitest'

import { parseProbeScanner } from './signatureParser'

describe('probe scanner signature parser', () => {
  it('parses scanned and unscanned rows while rejecting malformed input', () => {
    const text = [
      'ABC-123\tCosmic Signature\tWormhole\tUnstable Wormhole\t100.0%\t1 AU',
      'DEF-456\tCosmic Signature\t\t\t0.0%\t4 AU',
      'not a signature',
    ].join('\n')

    expect(parseProbeScanner(text)).toEqual([
      { signature_id: 'ABC-123', signature_category_id: null, signature_type_id: null, raw_type_name: 'Unstable Wormhole' },
      { signature_id: 'DEF-456', signature_category_id: null, signature_type_id: null, raw_type_name: null },
    ])
  })
})
