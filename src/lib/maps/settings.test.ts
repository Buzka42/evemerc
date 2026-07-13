import { describe, expect, it } from 'vitest'
import { normalizeMapRoutingSettings } from './settings'

describe('map routing settings', () => {
  it('normalizes the API resource envelope', () => {
    expect(normalizeMapRoutingSettings({ data: {
      map: {},
      map_user_settings: { route_preference: 'safer', security_penalty: 22, route_use_evescout: false, tracking_allowed: true },
      is_owner: true,
      can_manage_access: true,
      is_public: true,
      share_token: 'abc',
      permission: 'admin',
    } })).toEqual({
      isOwner: true,
      canManageAccess: true,
      permission: 'admin',
      isPublic: true,
      shareToken: 'abc',
      routePreference: 'safer',
      securityPenalty: 22,
      routeUseEveScout: false,
      trackingAllowed: true,
    })
  })
})
