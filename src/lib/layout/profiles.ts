export type PanelId = 'fleet-command' | 'wormhole-chain' | 'account' | 'telemetry' | 'map-settings'

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
      { id: 'map-settings', visible: true, weight: 20 },
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
      { id: 'map-settings', visible: false, weight: 10 },
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
      { id: 'map-settings', visible: true, weight: 15 },
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

/**
 * Maps each dock panel to the feature module that owns it. `null` means the panel is shell
 * chrome (not tied to a toggleable feature) and is always eligible regardless of module state.
 * Extend this as more panels move from inline App.svelte blocks into real FeatureModule panels.
 */
export const panelModuleOwners: Record<PanelId, string | null> = {
  'fleet-command': 'fleet',
  'wormhole-chain': 'wormhole-map',
  account: null,
  telemetry: null,
  'map-settings': null,
}

/**
 * A panel is eligible for the dock when the profile marks it visible AND, if it is owned by a
 * feature module, that module is currently enabled. Pure and DOM-free so it is unit-testable
 * without a dockview instance.
 */
export function resolveVisiblePanels(profile: LayoutProfile, isModuleEnabled: (moduleId: string) => boolean): PanelId[] {
  return profile.panels
    .filter((panel) => panel.visible)
    .map((panel) => panel.id)
    .filter((panelId) => {
      const owner = panelModuleOwners[panelId]
      return owner === null || isModuleEnabled(owner)
    })
}
