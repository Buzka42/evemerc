import { describe, expect, it } from 'vitest';

import { createModuleRegistry } from '.';

describe('default module registry', () => {
  it('ships fleet command as core and wormhole mapping as optional', () => {
    const registry = createModuleRegistry();

    expect(registry.isEnabled('fleet')).toBe(true);
    expect(registry.isEnabled('regional')).toBe(true);
    expect(registry.isEnabled('local-telemetry')).toBe(true);
    expect(registry.isEnabled('wormhole-map')).toBe(true);

    registry.disable('wormhole-map');
    expect(registry.isEnabled('wormhole-map')).toBe(false);
  });
});
