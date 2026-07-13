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

export interface EveLogObservation {
  kind: 'jump_started';
  observedAt: string;
  characterId: number | null;
  fromSystem: string;
  toSystem: string;
  sourceEventId: string;
}

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
