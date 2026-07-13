import type { Component } from 'svelte';
import type { EveMercApi } from '../api/client';

export type IconName = string;
export type PanelPlacement = 'center' | 'left' | 'right' | 'bottom' | 'floating';

export interface PanelDefinition {
  id: string;
  title: string;
  icon: IconName;
  component: () => Promise<{ default: Component }>;
  defaultPlacement: PanelPlacement;
  popoutable: boolean;
  minSize?: { width: number; height: number };
  requiresMap?: boolean;
}

export interface RegionalLayerDefinition {
  id: string;
  title: string;
  load: (context: RegionalLayerContext) => Promise<RegionalLayerData>;
}

export interface RegionalLayerContext {
  api: EveMercApi;
  mapSlug: string;
  regionId: number;
}

export interface RegionalLayerData {
  layerId: string;
  indicators: Record<number, { intensity: number; label: string; color: string }>;
  /** A distinct visual channel (a colored ring around the system dot) for ownership-style overlays that shouldn't compete with `indicators`' intensity glow. */
  rings?: Record<number, { label: string; color: string }>;
  /** Raw ship/NPC kill counts for the tactical-HUD numeric badges next to a system node, distinct from `indicators`' aggregated intensity glow. */
  killCounts?: Record<number, { shipKills: number; npcKills: number }>;
}

export interface FleetWidgetDefinition {
  id: string;
  title: string;
  load: () => Promise<unknown>;
}

export interface IntelProviderDefinition {
  id: string;
  version: number;
  load: () => Promise<unknown>;
}

export interface CommandDefinition {
  id: string;
  title: string;
  execute: () => void | Promise<void>;
}

export interface FeatureModule {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  core?: boolean;
  enabledByDefault?: boolean;
  panels: PanelDefinition[];
  regionalLayers?: RegionalLayerDefinition[];
  fleetWidgets?: FleetWidgetDefinition[];
  intelProviders?: IntelProviderDefinition[];
  commands?: CommandDefinition[];
}
