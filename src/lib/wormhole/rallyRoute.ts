import type { ChainSnapshot } from './types'

/**
 * BFS jump count between two systems within a wormhole chain's own connection graph, keyed by
 * map_solarsystem row id (not raw solarsystem id) - a dedicated, purpose-built shortest-path
 * function rather than reusing lib/routing/pathfinder.ts, which operates in a different id space
 * (raw solarsystem ids) and is designed for cross-region stargate routing, not a single map's
 * wormhole connection graph.
 */
export function jumpsBetween(snapshot: ChainSnapshot, fromMapSolarsystemId: number, toMapSolarsystemId: number): number | null {
  if (fromMapSolarsystemId === toMapSolarsystemId) return 0

  const adjacency = new Map<number, number[]>()
  for (const connection of snapshot.connections) {
    addEdge(adjacency, connection.fromMapSolarsystemId, connection.toMapSolarsystemId)
    addEdge(adjacency, connection.toMapSolarsystemId, connection.fromMapSolarsystemId)
  }

  const visited = new Set([fromMapSolarsystemId])
  let frontier = [fromMapSolarsystemId]
  let jumps = 0

  while (frontier.length > 0) {
    jumps += 1
    const next: number[] = []
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (neighbor === toMapSolarsystemId) return jumps
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }

  return null
}

function addEdge(adjacency: Map<number, number[]>, from: number, to: number): void {
  const existing = adjacency.get(from)
  if (existing) {
    existing.push(to)
  } else {
    adjacency.set(from, [to])
  }
}
