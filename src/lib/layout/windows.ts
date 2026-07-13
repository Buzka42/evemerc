import { invoke, isTauri } from '@tauri-apps/api/core'
import type { PanelId } from './profiles'

export async function openPanelWindow(panelId: PanelId, alwaysOnTop = true, opacity = 0.94): Promise<void> {
  if (!isTauri()) return

  await invoke('open_panel_window', { panelId, alwaysOnTop, opacity })
}

export async function setPanelAlwaysOnTop(panelId: PanelId, alwaysOnTop: boolean): Promise<void> {
  if (!isTauri()) return

  await invoke('set_panel_always_on_top', { panelId, alwaysOnTop })
}

export async function controlMainWindow(action: 'minimize' | 'toggle-maximize' | 'close'): Promise<void> {
  if (!isTauri()) return
  await invoke('control_main_window', { action })
}
