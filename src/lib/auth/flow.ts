import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrent, isRegistered, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { openUrl } from '@tauri-apps/plugin-opener'

import { createEveMercApi, type AccessTokenStore, type EveMercApi } from '../api/client'
import { createPkceAttempt, desktopAuthUrl, type PkceAttempt, validateAuthCallback } from './pkce'

const deepLinkRedirectUri = 'evemerc://auth/callback'

export type AuthFlowState =
  | { phase: 'idle' }
  | { phase: 'waiting_for_browser' }
  | { phase: 'exchanging_code' }
  | { phase: 'authenticated' }
  | { phase: 'failed'; message: string }

export interface DesktopAuthFlowOptions {
  serverUrl: string
  tokenStore: AccessTokenStore
  onStateChange?: (state: AuthFlowState) => void
}

export class DesktopAuthFlow {
  private attempt: PkceAttempt | null = null
  private readonly api: EveMercApi

  constructor(private readonly options: DesktopAuthFlowOptions) {
    this.api = createEveMercApi({ baseUrl: options.serverUrl, tokenStore: options.tokenStore })
  }

  async start(): Promise<void> {
    this.attempt = await createPkceAttempt()
    this.changeState({ phase: 'waiting_for_browser' })
    const redirectUri = await authRedirectUri()
    const url = desktopAuthUrl(this.options.serverUrl, this.attempt, redirectUri)

    if (isTauri()) {
      await openUrl(url.toString())
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  async acceptCallback(callbackUrl: string): Promise<void> {
    if (!this.attempt) {
      throw new Error('No desktop login attempt is currently active.')
    }

    try {
      const code = validateAuthCallback(callbackUrl, this.attempt.state)
      this.changeState({ phase: 'exchanging_code' })
      const { data, error } = await this.api.POST('/api/v1/auth/token', {
        body: {
          code,
          code_verifier: this.attempt.codeVerifier,
          device_name: await deviceName(),
        },
      })

      if (error || !data?.token) {
        throw new Error('The server did not accept this desktop login attempt.')
      }

      await this.options.tokenStore.set(data.token)
      this.attempt = null
      this.changeState({ phase: 'authenticated' })
    } catch (error) {
      this.attempt = null
      this.changeState({ phase: 'failed', message: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  private changeState(state: AuthFlowState): void {
    this.options.onStateChange?.(state)
  }
}

export async function listenForAuthCallbacks(handler: (url: string) => void): Promise<() => void> {
  if (!isTauri()) {
    return () => undefined
  }

  const current = await getCurrent()
  current?.filter(isAuthCallback).forEach(handler)
  const unlistenDeepLink = await onOpenUrl((urls) => urls.filter(isAuthCallback).forEach(handler))
  const unlistenLoopback = await listen<string>('auth://callback', (event) => {
    if (isAuthCallback(event.payload)) {
      handler(event.payload)
    }
  })

  return () => {
    unlistenDeepLink()
    unlistenLoopback()
  }
}

function isAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url)
    const isDeepLink = parsed.protocol === 'evemerc:' && parsed.hostname === 'auth' && parsed.pathname === '/callback'
    const isLoopback = parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.pathname === '/callback'
    return isDeepLink || isLoopback
  } catch {
    return false
  }
}

async function authRedirectUri(): Promise<string> {
  if (!isTauri()) {
    return deepLinkRedirectUri
  }

  try {
    if (await isRegistered('evemerc')) {
      return deepLinkRedirectUri
    }
  } catch {
    // The loopback receiver below is the supported fallback on platforms without runtime checks.
  }

  return invoke<string>('start_loopback_auth_listener')
}

async function deviceName(): Promise<string> {
  return isTauri() ? invoke<string>('device_name') : 'EVEMerc Desktop'
}
