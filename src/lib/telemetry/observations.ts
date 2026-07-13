export type LocationState = 'confirmed' | 'in_transit' | 'uncertain';
export type LocationSource = 'esi_character' | 'esi_fleet' | 'eve_gamelog';

export interface LocationObservation {
  characterId: number;
  solarSystemId: number;
  observedAt: string;
  state: Exclude<LocationState, 'uncertain'>;
  source: LocationSource;
  revision: number;
  sourceEventId?: string;
}

export interface FusedLocation {
  primary: LocationObservation;
  state: LocationState;
  alternatives: LocationObservation[];
}

export interface LocationObservationSubmission {
  character_id: number;
  solar_system_id: number;
  observed_at: string;
  state: 'in_transit' | 'confirmed';
  source_event_id: string;
}
