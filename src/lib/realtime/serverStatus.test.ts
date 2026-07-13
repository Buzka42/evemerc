import { describe, expect, it } from 'vitest'
import { serverStatusFromEvent } from './serverStatus'

describe('server status events', () => {
  it('accepts the Laravel event envelope and rejects incomplete payloads', () => {
    expect(serverStatusFromEvent({ server_status: { players: 22_000, vip: false, server_version: '123' } })).toEqual({
      players: 22_000,
      vip: false,
      serverVersion: '123',
    })
    expect(serverStatusFromEvent({ server_status: { players: 'many' } })).toBeNull()
  })
})
