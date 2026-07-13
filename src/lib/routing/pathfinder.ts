import type { RegionTopology } from '../sde/bridge'
import type { ChainSnapshot } from '../wormhole/types'

/**
 * Client-side route pathfinder, ported from the web app's `resources/js/composables/
 * useRoutingWorker.ts` (Dijkstra over a static stargate graph + dynamic wormhole/EVE-Scout
 * connections). This is genuinely not backend-blocked - the web app never calls a routing
 * endpoint per search, it computes routes entirely from already-loaded map/static data. The only
 * desktop-side gap was a Rust command exposing the full cross-region stargate graph (the existing
 * `get_region_topology` is scoped to one region for the map view); see `sde::get_universe_graph`.
 */

export type ConnectionType = 'stargate' | 'wormhole'
export type RoutePreference = 'shorter' | 'safer' | 'less_secure'
export type MassStatus = 'fresh' | 'reduced' | 'critical'
export type LifetimeStatus = 'healthy' | 'eol' | 'critical'

export interface RoutingSettings {
  routePreference: RoutePreference
  securityPenalty: number
  lifetimeStatus: LifetimeStatus
  massStatus: MassStatus
}

export interface RoutingConnection {
  from: number
  to: number
  type: ConnectionType
  massStatus?: MassStatus | null
  lifetimeStatus?: LifetimeStatus | null
}

export interface RouteStep {
  id: number
  via: ConnectionType | null
}

export interface RouteResult {
  route: RouteStep[]
  jumps: number
  cost: number
}

export interface ClosestSystem {
  solarsystemId: number
  jumps: number
  cost: number
  route: RouteStep[]
}

export type ClosestCondition = 'highsec' | 'lowsec' | 'nullsec'

interface StaticSystem {
  id: number
  security: number
}

// Zarzakh uses Jovian stargates that require special access - don't route through it.
const ZARZAKH_SYSTEM_ID = 30_100_000

const massStatusAllowList: Record<MassStatus, Set<MassStatus>> = {
  fresh: new Set(['fresh']),
  reduced: new Set(['fresh', 'reduced']),
  critical: new Set(['fresh', 'reduced', 'critical']),
}

const lifetimeStatusAllowList: Record<LifetimeStatus, Set<LifetimeStatus>> = {
  healthy: new Set(['healthy']),
  eol: new Set(['healthy', 'eol']),
  critical: new Set(['healthy', 'eol', 'critical']),
}

export class UniverseGraph {
  private readonly systems = new Map<number, StaticSystem>()
  private readonly adjacency = new Map<number, RoutingConnection[]>()

  constructor(topology: RegionTopology) {
    for (const system of topology.systems) {
      this.systems.set(system.id, { id: system.id, security: system.security })
    }
    for (const jump of topology.jumps) {
      addEdge(this.adjacency, jump.fromSystemId, { from: jump.fromSystemId, to: jump.toSystemId, type: 'stargate' })
      addEdge(this.adjacency, jump.toSystemId, { from: jump.toSystemId, to: jump.fromSystemId, type: 'stargate' })
    }
  }

  hasSystem(id: number): boolean {
    return this.systems.has(id)
  }

  security(id: number): number | null {
    return this.systems.get(id)?.security ?? null
  }

  neighbors(id: number): RoutingConnection[] {
    return this.adjacency.get(id) ?? []
  }

  get size(): number {
    return this.systems.size
  }
}

/** Builds a routable connection list from a wormhole chain snapshot's map_solarsystem-keyed
 *  connections, translated to raw solarsystem ids (the id space `RoutingConnection`/`UniverseGraph`
 *  operate in). */
export function dynamicConnectionsFromChain(snapshot: ChainSnapshot): RoutingConnection[] {
  const solarsystemIdByMapSolarsystemId = new Map(snapshot.systems.map((system) => [system.id, system.solarsystemId]))
  const connections: RoutingConnection[] = []

  for (const connection of snapshot.connections) {
    const from = solarsystemIdByMapSolarsystemId.get(connection.fromMapSolarsystemId)
    const to = solarsystemIdByMapSolarsystemId.get(connection.toMapSolarsystemId)
    if (from === undefined || to === undefined) continue

    connections.push({
      from,
      to,
      type: 'wormhole',
      massStatus: connection.massStatus as MassStatus | null,
      lifetimeStatus: connection.lifetimeStatus as LifetimeStatus | null,
    })
  }

  return connections
}

function addEdge(map: Map<number, RoutingConnection[]>, from: number, edge: RoutingConnection): void {
  const existing = map.get(from)
  if (existing) {
    existing.push(edge)
  } else {
    map.set(from, [edge])
  }
}

function buildDynamicAdjacency(connections: RoutingConnection[]): Map<number, RoutingConnection[]> {
  const adjacency = new Map<number, RoutingConnection[]>()
  for (const edge of connections) {
    addEdge(adjacency, edge.from, edge)
    addEdge(adjacency, edge.to, { ...edge, from: edge.to, to: edge.from })
  }
  return adjacency
}

function isEdgeAllowed(edge: RoutingConnection, settings: RoutingSettings): boolean {
  if (edge.type === 'stargate') return true
  if (edge.lifetimeStatus && !lifetimeStatusAllowList[settings.lifetimeStatus].has(edge.lifetimeStatus)) return false
  if (edge.massStatus && !massStatusAllowList[settings.massStatus].has(edge.massStatus)) return false
  return true
}

function isIgnoredNode(nodeId: number, fromId: number, toId: number | undefined, ignored: Set<number>): boolean {
  if (nodeId === fromId || (toId !== undefined && nodeId === toId)) return false
  return ignored.has(nodeId)
}

function getEdgeCost(settings: RoutingSettings, security: number): number {
  if (settings.routePreference === 'shorter') return 1

  const penaltyCost = Math.exp(0.15 * settings.securityPenalty)

  if (settings.routePreference === 'safer') {
    if (security <= 0) return 2 * penaltyCost
    if (security < 0.45) return penaltyCost
    return 0.9
  }

  // less_secure
  if (security <= 0) return 2 * penaltyCost
  if (security < 0.45) return 0.9
  return penaltyCost
}

function buildIgnoredSet(ignoredSystems: number[]): Set<number> {
  const ignored = new Set(ignoredSystems.filter(Boolean))
  ignored.add(ZARZAKH_SYSTEM_ID)
  return ignored
}

function getNeighbors(nodeId: number, universe: UniverseGraph, dynamicAdj: Map<number, RoutingConnection[]>): RoutingConnection[] {
  return [...universe.neighbors(nodeId), ...(dynamicAdj.get(nodeId) ?? [])]
}

function reconstructRoute(targetId: number, previous: Map<number, number | null>, via: Map<number, ConnectionType | null>): RouteStep[] {
  const path: RouteStep[] = []
  let node: number | null = targetId
  while (node !== null) {
    path.push({ id: node, via: via.get(node) ?? null })
    node = previous.get(node) ?? null
  }
  return path.reverse()
}

export function findRoute(
  universe: UniverseGraph,
  settings: RoutingSettings,
  fromId: number,
  toId: number,
  dynamicConnections: RoutingConnection[],
  ignoredSystems: number[],
): RouteResult {
  if (universe.size === 0) return { route: [], jumps: 0, cost: 0 }

  const dynamicAdj = buildDynamicAdjacency(dynamicConnections)
  const ignored = buildIgnoredSet(ignoredSystems)

  const distances = new Map<number, number>()
  const previous = new Map<number, number | null>()
  const via = new Map<number, ConnectionType | null>()
  const queue = new PriorityQueue<number>()

  distances.set(fromId, 0)
  previous.set(fromId, null)
  via.set(fromId, null)
  queue.push(fromId, 0)

  while (!queue.isEmpty()) {
    const current = queue.pop()
    if (!current) break

    const currentId = current.value
    const currentCost = current.priority
    if (currentId === toId) break
    if (currentCost > (distances.get(currentId) ?? Infinity)) continue

    for (const neighbor of getNeighbors(currentId, universe, dynamicAdj)) {
      if (isIgnoredNode(neighbor.to, fromId, toId, ignored)) continue
      if (!isEdgeAllowed(neighbor, settings)) continue
      const security = universe.security(neighbor.to)
      if (security === null) continue

      const newCost = currentCost + getEdgeCost(settings, security)
      if (newCost < (distances.get(neighbor.to) ?? Infinity)) {
        distances.set(neighbor.to, newCost)
        previous.set(neighbor.to, currentId)
        via.set(neighbor.to, neighbor.type)
        queue.push(neighbor.to, newCost)
      }
    }
  }

  if (!distances.has(toId)) return { route: [], jumps: 0, cost: 0 }

  const path = reconstructRoute(toId, previous, via)
  return { route: path, jumps: Math.max(0, path.length - 1), cost: distances.get(toId) ?? 0 }
}

function matchesCondition(security: number, condition: ClosestCondition): boolean {
  switch (condition) {
    case 'highsec': return security >= 0.5
    case 'lowsec': return security >= 0.1 && security <= 0.4
    case 'nullsec': return security <= 0
  }
}

export function findClosestSystems(
  universe: UniverseGraph,
  settings: RoutingSettings,
  fromId: number,
  condition: ClosestCondition,
  limit: number,
  dynamicConnections: RoutingConnection[],
  ignoredSystems: number[],
): ClosestSystem[] {
  if (universe.size === 0) return []

  const dynamicAdj = buildDynamicAdjacency(dynamicConnections)
  const ignored = buildIgnoredSet(ignoredSystems)
  const visited = new Set<number>(ignored)
  const previous = new Map<number, number | null>()
  const via = new Map<number, ConnectionType | null>()
  const queue = new PriorityQueue<{ id: number; jumps: number }>()
  const results: ClosestSystem[] = []

  visited.add(fromId)
  previous.set(fromId, null)
  via.set(fromId, null)
  queue.push({ id: fromId, jumps: 0 }, 0)

  const startSecurity = universe.security(fromId)
  if (startSecurity !== null && matchesCondition(startSecurity, condition)) {
    results.push({ solarsystemId: fromId, jumps: 0, cost: 0, route: [{ id: fromId, via: null }] })
  }

  while (!queue.isEmpty() && results.length < limit) {
    const current = queue.pop()
    if (!current) break

    const { id: currentId, jumps } = current.value
    const currentCost = current.priority

    for (const neighbor of getNeighbors(currentId, universe, dynamicAdj)) {
      if (isIgnoredNode(neighbor.to, fromId, undefined, ignored)) continue
      if (!isEdgeAllowed(neighbor, settings)) continue
      const security = universe.security(neighbor.to)
      if (security === null) continue

      const nextCost = currentCost + getEdgeCost(settings, security)
      const nextJumps = jumps + 1

      if (!visited.has(neighbor.to)) {
        visited.add(neighbor.to)
        previous.set(neighbor.to, currentId)
        via.set(neighbor.to, neighbor.type)
        queue.push({ id: neighbor.to, jumps: nextJumps }, nextCost)

        if (matchesCondition(security, condition)) {
          results.push({ solarsystemId: neighbor.to, jumps: nextJumps, cost: nextCost, route: reconstructRoute(neighbor.to, previous, via) })
          if (results.length >= limit) break
        }
      }
    }
  }

  return results
}

class PriorityQueue<T> {
  private readonly items: Array<{ priority: number; value: T }> = []

  push(value: T, priority: number): void {
    this.items.push({ priority, value })
    this.heapifyUp(this.items.length - 1)
  }

  pop(): { priority: number; value: T } | null {
    if (this.items.length === 0) return null
    this.swap(0, this.items.length - 1)
    const item = this.items.pop()!
    this.heapifyDown(0)
    return item
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  private heapifyUp(index: number): void {
    let current = index
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2)
      if (this.items[parent].priority <= this.items[current].priority) break
      this.swap(current, parent)
      current = parent
    }
  }

  private heapifyDown(index: number): void {
    let current = index
    for (;;) {
      const left = 2 * current + 1
      const right = 2 * current + 2
      let smallest = current
      if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left
      if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right
      if (smallest === current) break
      this.swap(current, smallest)
      current = smallest
    }
  }

  private swap(a: number, b: number): void {
    const temp = this.items[a]
    this.items[a] = this.items[b]
    this.items[b] = temp
  }
}
