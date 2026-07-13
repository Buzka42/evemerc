export interface ChainSignature {
  id: number
  signatureId: string | null
  rawTypeName: string | null
}

export interface ChainMapSolarsystem {
  id: number
  solarsystemId: number
  alias: string | null
  name: string | null
  status: string | null
  security: number | null
  wormholeClass: number | null
  effectName: string | null
  statics: string[]
  pinned: boolean
  x: number
  y: number
  signatures: ChainSignature[]
}

export interface ChainConnection {
  id: number
  fromMapSolarsystemId: number
  toMapSolarsystemId: number
  massStatus: string | null
  lifetimeStatus: string | null
  shipSize: string | null
}

export interface ChainConnectionUpdate {
  massStatus: 'fresh' | 'reduced' | 'critical' | 'unknown' | null
  lifetimeStatus: 'healthy' | 'eol' | 'critical' | null
  shipSize: 'frigate' | 'medium' | 'large' | null
}

export interface ChainSnapshot {
  mapId: number
  mapSlug: string
  homeSolarsystemId: number | null
  rallySolarsystemId: number | null
  systems: ChainMapSolarsystem[]
  connections: ChainConnection[]
  savedLocations: Array<{ id: number; solarsystemId: number; note: string | null }>
}

export interface SignatureCatalogEntry {
  id: number
  name: string
  categoryId: number
  categoryName: string
}

export interface ParsedSignature {
  signature_id: string
  signature_category_id: number | null
  signature_type_id: number | null
  raw_type_name: string | null
}
