import type { EveMercApi } from '../api/client'

export interface DesktopRelease {
  version: string
  downloadUrl: string
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const left = candidate.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const right = current.split('.').map((part) => Number.parseInt(part, 10) || 0)

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] ?? 0) > (right[index] ?? 0)) return true
    if ((left[index] ?? 0) < (right[index] ?? 0)) return false
  }
  return false
}

export async function checkLatestVersion(api: EveMercApi, currentVersion: string): Promise<DesktopRelease | null> {
  const { data, error } = await api.GET('/api/v1/desktop/latest-version')
  if (error || typeof data !== 'object' || data === null) return null

  const release = data as { version?: unknown; download_url?: unknown }
  if (typeof release.version !== 'string' || typeof release.download_url !== 'string') return null

  return isNewerVersion(release.version, currentVersion)
    ? { version: release.version, downloadUrl: release.download_url }
    : null
}
