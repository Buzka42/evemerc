import type { MapAuditEntry } from './api'

const fieldLabels: Record<string, string> = {
  status: 'status',
  alias: 'alias',
  occupier_alias: 'occupier alias',
  pinned: 'pin',
  notes: 'notes',
  position_x: 'position',
  position_y: 'position',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'nothing'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

function describeFieldChange(field: string, oldValue: unknown, newValue: unknown): string | null {
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return null
  const label = fieldLabels[field] ?? field.replace(/_/g, ' ')

  if (oldValue === null || oldValue === undefined || oldValue === '') {
    return `set ${label} to "${formatValue(newValue)}"`
  }
  if (newValue === null || newValue === undefined || newValue === '') {
    return `cleared ${label}`
  }
  return `changed ${label} from "${formatValue(oldValue)}" to "${formatValue(newValue)}"`
}

/**
 * Turns a raw audit-log row (event + old/new field diffs) into a human-readable sentence,
 * matching the web app's Audit.vue phrasing convention rather than showing raw field names.
 */
export function describeAudit(audit: MapAuditEntry): string {
  const actor = audit.characterName ?? 'The system'

  if (audit.event === 'created') return `${actor} added this system to the map.`
  if (audit.event === 'deleted') return `${actor} removed this system from the map.`

  if (audit.event === 'updated') {
    const fields = new Set([...Object.keys(audit.oldValues), ...Object.keys(audit.newValues)])
      .values()
    const changes = [...fields]
      .filter((field) => field !== 'position_x' && field !== 'position_y')
      .flatMap((field) => {
        const description = describeFieldChange(field, audit.oldValues[field], audit.newValues[field])
        return description ? [description] : []
      })

    if (changes.length === 0) return `${actor} moved this system.`
    return `${actor} ${changes.join(', ')}.`
  }

  return `${actor} ${audit.event} this system.`
}
