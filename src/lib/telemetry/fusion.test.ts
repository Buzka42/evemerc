import { describe, expect, it } from 'vitest';

import type { EveLogObservation } from './eveLogs';
import { fuseLocationObservations, jumpObservationSubmission } from './fusion';
import type { LocationObservation } from './observations';

function observation(overrides: Partial<LocationObservation> = {}): LocationObservation {
  return {
    characterId: 90_000_001,
    solarSystemId: 30_000_142,
    observedAt: '2026-07-12T19:41:32.000Z',
    state: 'confirmed',
    source: 'esi_character',
    revision: 1,
    ...overrides,
  };
}

describe('location source fusion', () => {
  it('does not let an older observation overwrite newer state', () => {
    const result = fuseLocationObservations([
      observation({ observedAt: '2026-07-12T19:41:30.000Z', solarSystemId: 1 }),
      observation({ observedAt: '2026-07-12T19:41:32.000Z', solarSystemId: 2 }),
    ]);

    expect(result?.primary.solarSystemId).toBe(2);
  });

  it('marks comparable conflicting sources as uncertain', () => {
    const result = fuseLocationObservations([
      observation({ source: 'esi_fleet', solarSystemId: 1 }),
      observation({ source: 'eve_gamelog', solarSystemId: 2, state: 'in_transit' }),
    ]);

    expect(result?.state).toBe('uncertain');
    expect(result?.alternatives).toHaveLength(1);
  });

  it('prefers confirmed state when timestamp and revision are equal', () => {
    const result = fuseLocationObservations([
      observation({ state: 'in_transit' }),
      observation({ state: 'confirmed' }),
    ]);

    expect(result?.primary.state).toBe('confirmed');
  });

  it('converts a bound jump into a normalized in-transit submission', () => {
    const jump: EveLogObservation = {
      kind: 'jump_started',
      observedAt: '2026-07-12T19:41:32.000Z',
      characterId: 90_000_001,
      fromSystem: 'Jita',
      toSystem: 'Perimeter',
      sourceEventId: 'a'.repeat(64),
    };

    expect(jumpObservationSubmission(jump, (name) => (name === 'Perimeter' ? 30_000_144 : null))).toEqual({
      character_id: 90_000_001,
      solar_system_id: 30_000_144,
      observed_at: jump.observedAt,
      state: 'in_transit',
      source_event_id: jump.sourceEventId,
    });
  });

  it('does not publish unbound or unresolved jump observations', () => {
    const jump: EveLogObservation = {
      kind: 'jump_started',
      observedAt: '2026-07-12T19:41:32.000Z',
      characterId: null,
      fromSystem: 'Unknown',
      toSystem: 'Unknown',
      sourceEventId: 'b'.repeat(64),
    };

    expect(jumpObservationSubmission(jump, () => null)).toBeNull();
  });
});
