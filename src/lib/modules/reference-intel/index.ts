import type { FeatureModule } from '../types'

export const referenceIntelModule: FeatureModule = {
  id: 'reference-intel',
  title: 'Kill Activity Intel',
  description: 'Reference extension module that overlays recent player kill activity.',
  icon: 'radar',
  enabledByDefault: true,
  panels: [],
  regionalLayers: [{
    id: 'kill-activity',
    title: '24-hour kill activity',
    load: async (context) => {
      const provider = await import('./provider')
      return provider.loadKillActivityLayer(context)
    },
  }, {
    id: 'sovereignty',
    title: 'Sovereignty',
    load: async (context) => {
      const provider = await import('./sovereignty')
      return provider.loadSovereigntyLayer(context.api)
    },
  }],
}
