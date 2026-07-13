import type { EveLogObservation } from './eveLogs';
import type {
  FusedLocation,
  LocationObservation,
  LocationObservationSubmission,
} from './observations';

const DEFAULT_CONFLICT_WINDOW_MS = 2_000;

export function fuseLocationObservations(
  observations: LocationObservation[],
  conflictWindowMs = DEFAULT_CONFLICT_WINDOW_MS,
): FusedLocation | null {
  const ordered = [...observations]
    .filter(({ observedAt }) => Number.isFinite(Date.parse(observedAt)))
    .sort(compareObservations);

  const primary = ordered[0];
  if (!primary) {
    return null;
  }

  const primaryTime = Date.parse(primary.observedAt);
  const alternatives = ordered.filter(
    (observation) =>
      observation.solarSystemId !== primary.solarSystemId &&
      primaryTime - Date.parse(observation.observedAt) <= conflictWindowMs,
  );

  return {
    primary,
    state: alternatives.length > 0 ? 'uncertain' : primary.state,
    alternatives,
  };
}

export function jumpObservationSubmission(
  observation: EveLogObservation,
  resolveSystemId: (systemName: string) => number | null,
): LocationObservationSubmission | null {
  if (observation.kind !== 'jump_started' || observation.characterId === null) {
    return null;
  }

  const destinationId = resolveSystemId(observation.toSystem);
  if (destinationId === null) {
    return null;
  }

  return {
    character_id: observation.characterId,
    solar_system_id: destinationId,
    observed_at: observation.observedAt,
    state: 'in_transit',
    source_event_id: observation.sourceEventId,
  };
}

function compareObservations(left: LocationObservation, right: LocationObservation): number {
  const timeDifference = Date.parse(right.observedAt) - Date.parse(left.observedAt);
  if (timeDifference !== 0) {
    return timeDifference;
  }

  const revisionDifference = right.revision - left.revision;
  if (revisionDifference !== 0) {
    return revisionDifference;
  }

  if (left.state === right.state) {
    return 0;
  }

  return left.state === 'confirmed' ? -1 : 1;
}
