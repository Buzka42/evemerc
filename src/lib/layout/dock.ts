import { createDockview, themeAbyss, type DockviewApi, type IContentRenderer } from 'dockview-core'
import type { LayoutProfile, PanelId } from './profiles'

const panelTitles: Record<PanelId, string> = {
  'fleet-command': 'Regional Fleet Command',
  'wormhole-chain': 'Wormhole Chain',
  account: 'Account',
  telemetry: 'Operations',
}

export interface DockWorkspace {
  applyProfile(profile: LayoutProfile): void
  dispose(): void
}

class ExistingElementRenderer implements IContentRenderer {
  readonly element = document.createElement('div')

  constructor(
    private readonly content: HTMLElement,
    private readonly source: HTMLElement,
  ) {
    this.element.className = 'h-full overflow-auto bg-slate-950/40'
  }

  init(): void {
    this.content.classList.remove('hidden')
    if (this.content.tagName === 'ASIDE') this.content.classList.add('flex')
    this.element.append(this.content)
  }

  dispose(): void {
    this.content.classList.remove('flex')
    this.content.classList.add('hidden')
    this.source.append(this.content)
    this.element.remove()
  }
}

export function createDockWorkspace(host: HTMLElement, source: HTMLElement, profile: LayoutProfile): DockWorkspace {
  const api = createDockview(host, {
    theme: themeAbyss,
    keyboardNavigation: true,
    createComponent: ({ name }) => {
      const content = source.querySelector<HTMLElement>(`[data-dock-panel="${name}"]`)
      if (!content) throw new Error(`Dock panel ${name} was not registered.`)
      return new ExistingElementRenderer(content, source)
    },
  })

  let applying = false
  const saveLayout = (): void => {
    if (!applying) window.localStorage.setItem(`evemerc.dock.${profile.id}`, JSON.stringify(api.toJSON()))
  }
  const disposable = api.onDidLayoutChange(saveLayout)

  function addPanel(panelId: PanelId, position?: { referencePanel: PanelId; direction: 'right' | 'below' }): void {
    if (!source.querySelector(`[data-dock-panel="${panelId}"]`)) return
    api.addPanel({
      id: panelId,
      component: panelId,
      title: panelTitles[panelId],
      position,
    })
  }

  function loadProfile(nextProfile: LayoutProfile): void {
    applying = true
    profile = nextProfile
    api.closeAllGroups()
    const saved = window.localStorage.getItem(`evemerc.dock.${profile.id}`)
    if (saved) {
      try {
        api.fromJSON(JSON.parse(saved) as ReturnType<DockviewApi['toJSON']>)
        const expectedPanels = profile.panels
          .filter((panel) => panel.visible && source.querySelector(`[data-dock-panel="${panel.id}"]`))
          .map((panel) => panel.id)
        if (!expectedPanels.every((panelId) => api.getPanel(panelId))) {
          throw new Error('Saved dock layout is missing a required panel.')
        }
        applying = false
        return
      } catch {
        api.closeAllGroups()
        window.localStorage.removeItem(`evemerc.dock.${profile.id}`)
      }
    }

    const visible = new Set(profile.panels.filter((panel) => panel.visible).map((panel) => panel.id))
    addPanel('fleet-command')
    if (visible.has('telemetry')) addPanel('telemetry', { referencePanel: 'fleet-command', direction: 'right' })
    if (visible.has('wormhole-chain')) addPanel('wormhole-chain', { referencePanel: 'fleet-command', direction: 'below' })
    applying = false
    saveLayout()
  }

  loadProfile(profile)

  return {
    applyProfile: loadProfile,
    dispose(): void {
      disposable.dispose()
      api.dispose()
    },
  }
}
