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
