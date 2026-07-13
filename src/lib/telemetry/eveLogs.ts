import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface EveLogStatus {
  root: string | null;
  watching: boolean;
  gamelogFiles: number;
  chatlogFiles: number;
  observationsEmitted: number;
  chatLinesRead: number;
  readErrors: number;
  lastObservationAt: string | null;
}

interface EveLogObservationBase {
  observedAt: string;
  characterId: number | null;
  sourceEventId: string;
}

export type CombatDirection = 'incoming' | 'outgoing';

export interface JumpStartedObservation extends EveLogObservationBase {
  kind: 'jump_started';
  fromSystem: string;
  toSystem: string;
}

export interface LocationConfirmedObservation extends EveLogObservationBase {
  kind: 'location_confirmed';
  system: string;
}

export interface CombatMissObservation extends EveLogObservationBase {
  kind: 'combat_miss';
  direction: CombatDirection;
  counterpart: string;
  weapon: string | null;
}

export interface CombatHitObservation extends EveLogObservationBase {
  kind: 'combat_hit';
  direction: CombatDirection;
  counterpart: string;
  weapon: string | null;
  damage: number;
  hitQuality: string;
}

export type EveLogObservation =
  | JumpStartedObservation
  | LocationConfirmedObservation
  | CombatMissObservation
  | CombatHitObservation;

const browserStatus: EveLogStatus = {
  root: null,
  watching: false,
  gamelogFiles: 0,
  chatlogFiles: 0,
  observationsEmitted: 0,
  chatLinesRead: 0,
  readErrors: 0,
  lastObservationAt: null,
};

export async function startEveLogWatcher(root?: string): Promise<EveLogStatus> {
  if (!isTauri()) {
    return browserStatus;
  }

  return invoke<EveLogStatus>('start_eve_log_watcher', { root: root ?? null });
}

export async function getEveLogStatus(): Promise<EveLogStatus> {
  if (!isTauri()) {
    return browserStatus;
  }

  return invoke<EveLogStatus>('get_eve_log_status');
}

export async function onEveLogObservation(
  handler: (observation: EveLogObservation) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => undefined;
  }

  return listen<EveLogObservation>('eve-log://observation', (event) => handler(event.payload));
}

export function describeObservation(observation: EveLogObservation): string {
  switch (observation.kind) {
    case 'jump_started':
      return `${observation.fromSystem} → ${observation.toSystem}`;
    case 'location_confirmed':
      return `Undocked in ${observation.system}`;
    case 'combat_miss':
      return observation.direction === 'incoming'
        ? `${observation.counterpart} missed you`
        : `You missed ${observation.counterpart}${observation.weapon ? ` with ${observation.weapon}` : ''}`;
    case 'combat_hit':
      return observation.direction === 'incoming'
        ? `${observation.counterpart} ${observation.hitQuality.toLowerCase()} you for ${observation.damage}`
        : `You ${observation.hitQuality.toLowerCase()} ${observation.counterpart} for ${observation.damage}`;
  }
}
