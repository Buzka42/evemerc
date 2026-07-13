import type { EveMercApi } from '../api/client'

export type MapRoutingSettings = {
  isOwner: boolean
  canManageAccess: boolean
  permission: string | null
  isPublic: boolean
  shareToken: string | null
  routePreference: 'shorter' | 'safer' | 'less_secure'
  securityPenalty: number
  routeUseEveScout: boolean
  trackingAllowed: boolean
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function normalizeMapRoutingSettings(value: unknown): MapRoutingSettings {
  const envelope = record(value)
  const data = record(envelope.data ?? value)
  const map = record(data.map)
  const user = record(data.map_user_settings)
  const preference = user.route_preference

  return {
    isOwner: data.is_owner === true,
    permission: typeof data.permission === 'string' ? data.permission : null,
    canManageAccess: data.can_manage_access === true,
    isPublic: data.is_public === true,
    shareToken: typeof data.share_token === 'string' ? data.share_token : null,
    routePreference: preference === 'safer' || preference === 'less_secure' ? preference : 'shorter',
    securityPenalty: Number.isFinite(Number(user.security_penalty)) ? Number(user.security_penalty) : 0,
    routeUseEveScout: user.route_use_evescout !== false,
    trackingAllowed: user.tracking_allowed !== false,
  }
}

export async function fetchMapRoutingSettings(api: EveMercApi, mapSlug: string): Promise<MapRoutingSettings> {
  const { data, error } = await api.GET('/api/v1/maps/{map_slug}/routing-settings', { params: { path: { map_slug: mapSlug } } })
  if (error) throw new Error('Could not load map settings.')
  return normalizeMapRoutingSettings(data)
}

export async function updateMapRoutingSettings(api: EveMercApi, mapSlug: string, settings: MapRoutingSettings): Promise<void> {
  const { error } = await api.PUT('/api/v1/maps/{map_slug}/user-settings', {
    params: { path: { map_slug: mapSlug } },
    body: {
      route_preference: settings.routePreference,
      security_penalty: settings.securityPenalty,
      route_use_evescout: settings.routeUseEveScout,
      tracking_allowed: settings.trackingAllowed,
    },
  })
  if (error) throw new Error('Could not save map routing settings.')
}

export async function toggleMapPublic(api: EveMercApi, mapSlug: string): Promise<boolean> {
  const { data, error } = await api.POST('/api/v1/maps/{map_slug}/settings/toggle-public', { params: { path: { map_slug: mapSlug } } })
  if (error) throw new Error('Could not change public map access.')
  return record(record(data).data).is_public === true
}

export async function generateMapShareToken(api: EveMercApi, mapSlug: string): Promise<string | null> {
  const { data, error } = await api.POST('/api/v1/maps/{map_slug}/settings/generate-share-token', { params: { path: { map_slug: mapSlug } } })
  if (error) throw new Error('Could not generate a share token.')
  const token = record(record(data).data).share_token
  return typeof token === 'string' ? token : null
}

export async function revokeMapShareToken(api: EveMercApi, mapSlug: string): Promise<void> {
  const { error } = await api.DELETE('/api/v1/maps/{map_slug}/settings/revoke-share-token', { params: { path: { map_slug: mapSlug } } })
  if (error) throw new Error('Could not revoke the share token.')
}
