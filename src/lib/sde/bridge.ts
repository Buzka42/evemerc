import { invoke, isTauri } from '@tauri-apps/api/core'

export interface SdeStatus {
  version: string
  sizeBytes: number
  updated: boolean
}

export interface RegionTopology {
  systems: Array<{
    id: number
    name: string
    security: number
    positionX: number
    positionZ: number
  }>
  jumps: Array<{ fromSystemId: number; toSystemId: number }>
}

export interface SignatureCatalogEntry {
  id: number
  name: string
  categoryId: number
  categoryName: string
}

export interface SolarSystemDetails {
  id: number
  name: string
  security: number
  wormholeClass: number | null
  effectName: string | null
  statics: string[]
}

export async function syncSdeSnapshot(serverUrl: string): Promise<SdeStatus | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<SdeStatus>('sync_sde_snapshot', { serverUrl })
}

export async function resolveSolarSystem(name: string): Promise<number | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<number | null>('resolve_solar_system', { name })
}

export async function getRegionTopology(regionId: number): Promise<RegionTopology | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<RegionTopology | null>('get_region_topology', { regionId })
}

export async function getSignatureCatalog(): Promise<SignatureCatalogEntry[]> {
  if (!isTauri()) {
    return []
  }

  return invoke<SignatureCatalogEntry[]>('get_signature_catalog')
}

export async function getSolarSystemDetails(systemIds: number[]): Promise<SolarSystemDetails[]> {
  if (!isTauri() || systemIds.length === 0) return []
  return invoke<SolarSystemDetails[]>('get_solar_system_details', { systemIds })
}
