import { describe, expect, it } from 'vitest'

import { assertAllowedServerUrl, createPkceAttempt, desktopAuthUrl, validateAuthCallback } from './pkce'

describe('desktop PKCE', () => {
  it('creates verifier, challenge, and state values accepted by the backend', async () => {
    const attempt = await createPkceAttempt()

    expect(attempt.codeVerifier).toMatch(/^[A-Za-z0-9._~-]{96}$/)
    expect(attempt.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(attempt.state).toHaveLength(48)
  })

  it('constructs the desktop authentication URL', async () => {
    const attempt = await createPkceAttempt()
    const url = desktopAuthUrl('https://wormhole.systems/path', attempt, 'evemerc://auth/callback')

    expect(url.origin).toBe('https://wormhole.systems')
    expect(url.pathname).toBe('/auth/desktop/start')
    expect(url.searchParams.get('code_challenge')).toBe(attempt.codeChallenge)
    expect(url.searchParams.get('redirect_uri')).toBe('evemerc://auth/callback')
  })

  it('rejects mismatched callbacks and insecure remote servers', () => {
    expect(() => validateAuthCallback('evemerc://auth/callback?code=abc&state=wrong', 'expected')).toThrow()
    expect(() => assertAllowedServerUrl('http://example.com')).toThrow()
    expect(() => assertAllowedServerUrl('http://localhost:8000')).not.toThrow()
  })
})
