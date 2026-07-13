export type PanelId = 'fleet-command' | 'wormhole-chain' | 'account' | 'telemetry'

export interface LayoutPanel {
  id: PanelId
  visible: boolean
  weight: number
}

export interface LayoutProfile {
  id: string
  name: string
  panels: LayoutPanel[]
}

export const defaultLayoutProfiles: LayoutProfile[] = [
  {
    id: 'fleet-command',
    name: 'Fleet Command',
    panels: [
      { id: 'fleet-command', visible: true, weight: 70 },
      { id: 'wormhole-chain', visible: true, weight: 30 },
      { id: 'account', visible: true, weight: 20 },
      { id: 'telemetry', visible: true, weight: 20 },
    ],
  },
  {
    id: 'compact-fleet',
    name: 'Compact Fleet',
    panels: [
      { id: 'fleet-command', visible: true, weight: 85 },
      { id: 'wormhole-chain', visible: false, weight: 15 },
      { id: 'account', visible: false, weight: 10 },
      { id: 'telemetry', visible: true, weight: 15 },
    ],
  },
  {
    id: 'scanning',
    name: 'Scanning',
    panels: [
      { id: 'fleet-command', visible: true, weight: 55 },
      { id: 'wormhole-chain', visible: true, weight: 45 },
      { id: 'account', visible: false, weight: 10 },
      { id: 'telemetry', visible: true, weight: 20 },
    ],
  },
]

export function parseLayoutProfiles(value: string | null): LayoutProfile[] {
  if (!value) return defaultLayoutProfiles

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return defaultLayoutProfiles
    const profiles = parsed.filter(isLayoutProfile)
    return profiles.length > 0 ? profiles : defaultLayoutProfiles
  } catch {
    return defaultLayoutProfiles
  }
}

function isLayoutProfile(value: unknown): value is LayoutProfile {
  if (typeof value !== 'object' || value === null) return false
  const profile = value as Partial<LayoutProfile>
  return typeof profile.id === 'string'
    && typeof profile.name === 'string'
    && Array.isArray(profile.panels)
    && profile.panels.some((panel) => (
      typeof panel === 'object'
      && panel !== null
      && (panel as Partial<LayoutPanel>).id === 'fleet-command'
      && (panel as Partial<LayoutPanel>).visible === true
    ))
}

export function panelVisible(profile: LayoutProfile, panelId: PanelId): boolean {
  return profile.panels.find((panel) => panel.id === panelId)?.visible ?? false
}
