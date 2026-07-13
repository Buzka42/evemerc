import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

import type { AccessTokenStore, EveMercApi } from '../api/client'
import type { CharacterLocationObservedPayload, FleetMembersUpdatedPayload, FleetWaypointSetPayload } from './fleetEvents'
import type { TranquilityStatus } from './serverStatus'
import { serverStatusFromEvent } from './serverStatus'

export type ConnectionState = 'connected' | 'reconnecting' | 'offline'

export interface FleetRealtimeOptions {
  api: EveMercApi
  tokenStore: AccessTokenStore
  mapId: number
  onFleetMembersUpdated: (payload: FleetMembersUpdatedPayload) => void
  onCharacterLocationObserved: (payload: CharacterLocationObservedPayload) => void
  onFleetWaypointSet: (payload: FleetWaypointSetPayload) => void
  onChainInvalidated: () => void
  onWorkspaceInvalidated: () => void
  onConnectionState: (state: ConnectionState) => void
  onServerStatus: (status: TranquilityStatus) => void
}

export async function connectFleetRealtime(options: FleetRealtimeOptions): Promise<() => void> {
  const [{ data, error, response }, token] = await Promise.all([
    options.api.GET('/api/v1/realtime/config'),
    options.tokenStore.get(),
  ])

  if (error || !data?.key || !data.host || !token) {
    throw new Error(`Realtime configuration failed with HTTP ${response.status}.`)
  }

  ;(globalThis as typeof globalThis & { Pusher: typeof Pusher }).Pusher = Pusher
  const forceTLS = data.scheme === 'https'
  const echo = new Echo({
    broadcaster: 'reverb',
    key: data.key,
    wsHost: data.host,
    wsPort: data.port ?? 80,
    wssPort: data.port ?? 443,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: data.auth_endpoint,
    auth: { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  })

  const connection = echo.connector.pusher.connection
  connection.bind('connected', () => options.onConnectionState('connected'))
  connection.bind('connecting', () => options.onConnectionState('reconnecting'))
  connection.bind('unavailable', () => options.onConnectionState('offline'))
  connection.bind('disconnected', () => options.onConnectionState('offline'))
  const channel = echo.private(`Map.${options.mapId}`)
    .listen('.FleetMembersUpdated', options.onFleetMembersUpdated)
    .listen('.CharacterLocationObserved', options.onCharacterLocationObserved)
    .listen('.FleetWaypointSet', options.onFleetWaypointSet)
    .listen('.SystemKillStatsUpdated', options.onWorkspaceInvalidated)
    .listen('.App\\Events\\Characters\\CharacterStatusUpdatedEvent', options.onWorkspaceInvalidated)
    .listen('.App\\Events\\Maps\\MapUpdatedEvent', options.onWorkspaceInvalidated)
  echo.channel('ServerStatus').listen('.App\\Events\\ServerStatusUpdatedEvent', (payload: unknown) => {
    const status = serverStatusFromEvent(payload)
    if (status) options.onServerStatus(status)
  })
  for (const event of [
    '.App\\Events\\MapSolarsystems\\MapSolarsystemCreatedEvent',
    '.App\\Events\\MapSolarsystems\\MapSolarsystemUpdatedEvent',
    '.App\\Events\\MapSolarsystems\\MapSolarsystemDeletedEvent',
    '.App\\Events\\MapSolarsystems\\MapSolarsystemsUpdatedEvent',
    '.App\\Events\\MapSolarsystems\\MapSolarsystemsDeletedEvent',
    '.App\\Events\\MapConnections\\MapConnectionCreatedEvent',
    '.App\\Events\\MapConnections\\MapConnectionUpdatedEvent',
    '.App\\Events\\MapConnections\\MapConnectionDeletedEvent',
    '.App\\Events\\MapConnections\\MapConnectionsDeletedEvent',
    '.App\\Events\\Signatures\\SignatureCreatedEvent',
    '.App\\Events\\Signatures\\SignatureUpdatedEvent',
    '.App\\Events\\Signatures\\SignatureDeletedEvent',
    '.App\\Events\\MapRouteSolarsystemsUpdatedEvent',
  ]) {
    channel.listen(event, options.onChainInvalidated)
  }

  return () => {
    echo.leave(`Map.${options.mapId}`)
    echo.leave('ServerStatus')
    echo.disconnect()
  }
}
