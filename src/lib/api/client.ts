import createClient from 'openapi-fetch'

import type { paths } from './schema'

export interface AccessTokenStore {
  get(): Promise<string | null>
  set(token: string): Promise<void>
  clear(): Promise<void>
}

export class MemoryAccessTokenStore implements AccessTokenStore {
  private token: string | null = null

  async get(): Promise<string | null> {
    return this.token
  }

  async set(token: string): Promise<void> {
    this.token = token
  }

  async clear(): Promise<void> {
    this.token = null
  }
}

export interface EveMercApiOptions {
  baseUrl: string
  tokenStore: AccessTokenStore
  fetch?: typeof globalThis.fetch
}

export function createEveMercApi({ baseUrl, tokenStore, fetch }: EveMercApiOptions) {
  const client = createClient<paths>({ baseUrl, fetch })

  client.use({
    async onRequest({ request }) {
      const token = await tokenStore.get()

      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`)
      }

      request.headers.set('Accept', 'application/json')

      return request
    },
    async onResponse({ response }) {
      if (response.status === 401) {
        await tokenStore.clear()
      }

      return response
    },
  })

  return client
}

export type EveMercApi = ReturnType<typeof createEveMercApi>
