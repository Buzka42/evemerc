import { invoke, isTauri } from '@tauri-apps/api/core'

export async function readCache<T>(serverOrigin: string, namespace: string, key: string): Promise<T | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<T | null>('cache_get', { serverOrigin, namespace, key })
}

export async function writeCache<T>(
  serverOrigin: string,
  namespace: string,
  key: string,
  payload: T,
): Promise<void> {
  if (!isTauri()) {
    return
  }

  await invoke('cache_put', { serverOrigin, namespace, key, payload })
}

export async function purgeServerCache(serverOrigin: string): Promise<void> {
  if (isTauri()) {
    await invoke('cache_purge_server', { serverOrigin })
  }
}
