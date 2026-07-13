import { fleetModule } from './fleet';
import { localTelemetryModule } from './local-telemetry';
import { ModuleRegistry } from './registry';
import { regionalModule } from './regional';
import { referenceIntelModule } from './reference-intel';
import { wormholeMapModule } from './wormhole-map';

export function createModuleRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();

  registry.register(localTelemetryModule);
  registry.register(fleetModule);
  registry.register(regionalModule);
  registry.register(referenceIntelModule);
  registry.register(wormholeMapModule);

  return registry;
}
