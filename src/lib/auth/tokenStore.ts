import { invoke } from '@tauri-apps/api/core'

import type { AccessTokenStore } from '../api/client'

export class KeyringAccessTokenStore implements AccessTokenStore {
  private browserFallback: string | null = null

  constructor(private readonly serverOrigin = 'https://evemerc.test') {}

  async get(): Promise<string | null> {
    if (!isTauri()) {
      return this.browserFallback
    }

    return invoke<string | null>('load_access_token', { serverOrigin: this.serverOrigin })
  }

  async set(token: string): Promise<void> {
    if (!isTauri()) {
      this.browserFallback = token
      return
    }

    await invoke('store_access_token', { token, serverOrigin: this.serverOrigin })
  }

  async clear(): Promise<void> {
    if (!isTauri()) {
      this.browserFallback = null
      return
    }

    await invoke('clear_access_token', { serverOrigin: this.serverOrigin })
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
