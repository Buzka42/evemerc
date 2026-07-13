import { describe, expect, it } from 'vitest';

import { ModuleRegistry } from './registry';
import type { FeatureModule } from './types';

function module(overrides: Partial<FeatureModule> & Pick<FeatureModule, 'id'>): FeatureModule {
  return {
    title: overrides.id,
    description: `${overrides.id} module`,
    icon: 'circle',
    panels: [],
    ...overrides,
  };
}

describe('ModuleRegistry', () => {
  it('keeps core fleet modules enabled', () => {
    const registry = new ModuleRegistry();
    registry.register(module({ id: 'fleet', core: true }));

    expect(registry.isEnabled('fleet')).toBe(true);
    expect(() => registry.disable('fleet')).toThrow('cannot be disabled');
  });

  it('can unload every contribution from an optional intel module', () => {
    const registry = new ModuleRegistry();
    registry.register(
      module({
        id: 'intel-example',
        enabledByDefault: true,
        regionalLayers: [{ id: 'intel-example.layer', title: 'Example', load: async () => ({ layerId: 'intel-example.layer', indicators: {} }) }],
        fleetWidgets: [{ id: 'intel-example.widget', title: 'Example', load: async () => ({}) }],
      }),
    );

    expect(registry.regionalLayers()).toHaveLength(1);
    expect(registry.fleetWidgets()).toHaveLength(1);

    registry.disable('intel-example');

    expect(registry.regionalLayers()).toHaveLength(0);
    expect(registry.fleetWidgets()).toHaveLength(0);
  });

  it('rejects duplicate module and contribution identifiers', () => {
    const registry = new ModuleRegistry();
    registry.register(module({ id: 'one', commands: [{ id: 'shared', title: 'One', execute() {} }] }));

    expect(() => registry.register(module({ id: 'one' }))).toThrow('already registered');
    expect(() =>
      registry.register(module({ id: 'two', commands: [{ id: 'shared', title: 'Two', execute() {} }] })),
    ).toThrow('Contribution "shared"');
  });
});
