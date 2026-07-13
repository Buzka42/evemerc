import { describe, expect, it, vi } from 'vitest'

import { MemoryAccessTokenStore } from '../api/client'
import { DesktopAuthFlow } from './flow'

describe('desktop authentication flow', () => {
  it('rejects callbacks when no login attempt is active', async () => {
    const flow = new DesktopAuthFlow({
      serverUrl: 'https://wormhole.systems',
      tokenStore: new MemoryAccessTokenStore(),
    })

    await expect(flow.acceptCallback('evemerc://auth/callback?code=abc&state=state')).rejects.toThrow(
      'No desktop login attempt',
    )
  })

  it('reports the waiting state before opening the system browser', async () => {
    const states: string[] = []
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    const flow = new DesktopAuthFlow({
      serverUrl: 'https://wormhole.systems',
      tokenStore: new MemoryAccessTokenStore(),
      onStateChange: (state) => states.push(state.phase),
    })

    await flow.start()

    expect(states).toEqual(['waiting_for_browser'])
    expect(open).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
