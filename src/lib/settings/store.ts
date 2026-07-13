import { LazyStore } from '@tauri-apps/plugin-store'

import { normalizeServerUrl } from '../auth/pkce'

const settingsStore = new LazyStore('settings.json', { autoSave: 200, defaults: {} })
const defaultServerUrl = 'https://wormhole.systems'

export interface DesktopSettings {
  serverUrl: string
  eveLogsRoot: string | null
  enabledModules: string[]
  theme: 'dark' | 'light' | 'system'
  density: 'comfortable' | 'compact'
  /** Opt-in allowlist of chat channel names to parse for intel messages. Empty by default - a
   *  channel not in this list is only tailed and counted, never parsed (PLAN.md's stated design). */
  intelChannels: string[]
}

export async function loadSettings(): Promise<DesktopSettings> {
  const stored = await settingsStore.get<Partial<DesktopSettings>>('desktop')

  return {
    serverUrl: normalizeServerUrl(stored?.serverUrl ?? defaultServerUrl),
    eveLogsRoot: stored?.eveLogsRoot ?? null,
    enabledModules: stored?.enabledModules ?? ['local-telemetry', 'fleet', 'regional', 'reference-intel', 'wormhole-map'],
    theme: stored?.theme ?? 'dark',
    density: stored?.density ?? 'comfortable',
    intelChannels: stored?.intelChannels ?? [],
  }
}

export async function saveSettings(settings: DesktopSettings): Promise<void> {
  await settingsStore.set('desktop', {
    ...settings,
    serverUrl: normalizeServerUrl(settings.serverUrl),
  })
}
