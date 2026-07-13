import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'
import type { AccountCharacter } from '../account/api'
import type { FleetSnapshot } from '../fleet/status'
import type { RegionTopology } from '../sde/bridge'
import type { ChainSnapshot } from '../wormhole/types'
import type { RegionalLayerData } from '../modules/types'
import type { SystemIntel } from '../intel/system'
import type { FleetKill } from '../intel/killfeed'

export interface PanelWindowState {
  selectedMapSlug: string
  connectionState: 'connected' | 'reconnecting' | 'offline'
  objectiveSystemId: number | null
  fleetSnapshot: FleetSnapshot | null
  regionTopology: RegionTopology | null
  regionalLayers: RegionalLayerData[]
  chainSnapshot: ChainSnapshot | null
  selectedChainSystemId: number | null
  accountCharacters: AccountCharacter[]
  selectedRegionalSystemId: number | null
  selectedSystemIntel: SystemIntel | null
  fleetKills: FleetKill[]
  updatedAt: string
}

const STATE_EVENT = 'evemerc://panel-state'
const REQUEST_EVENT = 'evemerc://panel-state-request'

export async function publishPanelState(state: PanelWindowState): Promise<void> {
  if (isTauri()) await emit(STATE_EVENT, state)
}

export async function requestPanelState(): Promise<void> {
  if (isTauri()) await emit(REQUEST_EVENT)
}

export async function onPanelState(handler: (state: PanelWindowState) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined
  return listen<PanelWindowState>(STATE_EVENT, ({ payload }) => handler(payload))
}

export async function onPanelStateRequest(handler: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined
  return listen(REQUEST_EVENT, handler)
}
