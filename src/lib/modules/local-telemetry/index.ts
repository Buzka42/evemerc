import type { FeatureModule } from '../types';

export const localTelemetryModule: FeatureModule = {
  id: 'local-telemetry',
  title: 'Local EVE Telemetry',
  description: 'Privacy-preserving ESI and EVE log location fusion.',
  icon: 'radio-tower',
  core: true,
  panels: [],
};
