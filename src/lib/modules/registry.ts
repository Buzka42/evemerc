import type {
  CommandDefinition,
  FeatureModule,
  FleetWidgetDefinition,
  IntelProviderDefinition,
  PanelDefinition,
  RegionalLayerDefinition,
} from './types';

export class ModuleRegistry {
  readonly #modules = new Map<string, FeatureModule>();
  readonly #enabled = new Set<string>();

  register(module: FeatureModule): void {
    if (this.#modules.has(module.id)) {
      throw new Error(`Module "${module.id}" is already registered.`);
    }

    this.#assertContributionIdsAreUnique(module);
    this.#modules.set(module.id, module);

    if (module.core || module.enabledByDefault) {
      this.#enabled.add(module.id);
    }
  }

  enable(moduleId: string): void {
    this.#requireModule(moduleId);
    this.#enabled.add(moduleId);
  }

  disable(moduleId: string): void {
    const module = this.#requireModule(moduleId);
    if (module.core) {
      throw new Error(`Core module "${moduleId}" cannot be disabled.`);
    }

    this.#enabled.delete(moduleId);
  }

  isEnabled(moduleId: string): boolean {
    return this.#enabled.has(moduleId);
  }

  modules(): FeatureModule[] {
    return [...this.#modules.values()];
  }

  panels(): PanelDefinition[] {
    return this.#enabledModules().flatMap((module) => module.panels);
  }

  regionalLayers(): RegionalLayerDefinition[] {
    return this.#enabledModules().flatMap((module) => module.regionalLayers ?? []);
  }

  fleetWidgets(): FleetWidgetDefinition[] {
    return this.#enabledModules().flatMap((module) => module.fleetWidgets ?? []);
  }

  intelProviders(): IntelProviderDefinition[] {
    return this.#enabledModules().flatMap((module) => module.intelProviders ?? []);
  }

  commands(): CommandDefinition[] {
    return this.#enabledModules().flatMap((module) => module.commands ?? []);
  }

  #requireModule(moduleId: string): FeatureModule {
    const module = this.#modules.get(moduleId);
    if (!module) {
      throw new Error(`Unknown module "${moduleId}".`);
    }

    return module;
  }

  #enabledModules(): FeatureModule[] {
    return [...this.#modules.values()].filter((module) => this.#enabled.has(module.id));
  }

  #assertContributionIdsAreUnique(candidate: FeatureModule): void {
    const existingIds = new Set(
      this.modules().flatMap((module) => [
        ...module.panels.map(({ id }) => id),
        ...(module.regionalLayers ?? []).map(({ id }) => id),
        ...(module.fleetWidgets ?? []).map(({ id }) => id),
        ...(module.intelProviders ?? []).map(({ id }) => id),
        ...(module.commands ?? []).map(({ id }) => id),
      ]),
    );
    const candidateIds = [
      ...candidate.panels.map(({ id }) => id),
      ...(candidate.regionalLayers ?? []).map(({ id }) => id),
      ...(candidate.fleetWidgets ?? []).map(({ id }) => id),
      ...(candidate.intelProviders ?? []).map(({ id }) => id),
      ...(candidate.commands ?? []).map(({ id }) => id),
    ];

    for (const id of candidateIds) {
      if (existingIds.has(id)) {
        throw new Error(`Contribution "${id}" is already registered.`);
      }
      existingIds.add(id);
    }
  }
}
