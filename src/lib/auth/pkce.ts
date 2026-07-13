const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

export interface PkceAttempt {
  codeVerifier: string
  codeChallenge: string
  state: string
}

export async function createPkceAttempt(): Promise<PkceAttempt> {
  const codeVerifier = randomString(96)

  return {
    codeVerifier,
    codeChallenge: await sha256Base64Url(codeVerifier),
    state: randomString(48),
  }
}

export function desktopAuthUrl(serverUrl: string, attempt: PkceAttempt, redirectUri: string): URL {
  assertAllowedServerUrl(serverUrl)
  const url = new URL('/auth/desktop/start', normalizeServerUrl(serverUrl))
  url.searchParams.set('code_challenge', attempt.codeChallenge)
  url.searchParams.set('state', attempt.state)
  url.searchParams.set('redirect_uri', redirectUri)

  return url
}

export function validateAuthCallback(callbackUrl: string, expectedState: string): string {
  const url = new URL(callbackUrl)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || state !== expectedState) {
    throw new Error('The authentication callback was invalid or did not match this login attempt.')
  }

  return code
}

export function normalizeServerUrl(serverUrl: string): string {
  return new URL(serverUrl).origin
}

export function assertAllowedServerUrl(serverUrl: string): void {
  const url = new URL(serverUrl)
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
    throw new Error('The server must use HTTPS unless it is running on localhost.')
  }
}

function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))

  return Array.from(bytes, (byte) => VERIFIER_ALPHABET[byte % VERIFIER_ALPHABET.length]).join('')
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const binary = String.fromCharCode(...new Uint8Array(digest))

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
