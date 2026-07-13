export interface TranquilityStatus {
  players: number
  vip: boolean
  serverVersion: string | null
}

export function serverStatusFromEvent(payload: unknown): TranquilityStatus | null {
  if (typeof payload !== 'object' || payload === null) return null
  const wrapper = payload as { server_status?: unknown }
  if (typeof wrapper.server_status !== 'object' || wrapper.server_status === null) return null
  const status = wrapper.server_status as Record<string, unknown>
  if (typeof status.players !== 'number' || typeof status.vip !== 'boolean') return null

  return {
    players: status.players,
    vip: status.vip,
    serverVersion: typeof status.server_version === 'string' ? status.server_version : null,
  }
}
