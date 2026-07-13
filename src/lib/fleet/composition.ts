import type { FleetMember } from './status'

export interface CompositionEntry {
  shipTypeName: string
  count: number
  delta: number
}

const HISTORY_WINDOW_MS = 5 * 60 * 1000
const MAX_HISTORY_AGE_MS = 10 * 60 * 1000

interface HistoryPoint {
  timestamp: number
  counts: Map<string, number>
}

export function countByShipType(members: FleetMember[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const member of members) {
    const name = member.ship_type_name ?? 'Unknown'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}

/**
 * Tracks fleet composition snapshots over time so the UI can show a per-ship-type gain/loss
 * trend against where the fleet was ~5 minutes ago, matching the web app's FleetComposition.vue.
 * The clock is injectable for testability rather than hardcoding Date.now() everywhere.
 */
export class CompositionHistory {
  private readonly history: HistoryPoint[] = []
  private readonly now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  record(members: FleetMember[]): void {
    const timestamp = this.now()
    this.history.push({ timestamp, counts: countByShipType(members) })

    const cutoff = timestamp - MAX_HISTORY_AGE_MS
    while (this.history.length > 1 && this.history[0].timestamp < cutoff) {
      this.history.shift()
    }
  }

  composition(members: FleetMember[]): CompositionEntry[] {
    const current = countByShipType(members)
    const baseline = this.baselineCounts()
    const names = new Set([...current.keys(), ...(baseline?.keys() ?? [])])

    return [...names]
      .map((name) => ({
        shipTypeName: name,
        count: current.get(name) ?? 0,
        // No baseline yet (no observation is old enough to compare against) means "unknown
        // change", not "grew from zero" - report 0 rather than a misleading full-count delta.
        delta: baseline ? (current.get(name) ?? 0) - (baseline.get(name) ?? 0) : 0,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
  }

  private baselineCounts(): Map<string, number> | null {
    const targetTime = this.now() - HISTORY_WINDOW_MS
    let baseline: HistoryPoint | null = null
    for (const point of this.history) {
      if (point.timestamp <= targetTime) {
        baseline = point
      } else {
        break
      }
    }
    return baseline?.counts ?? null
  }
}
