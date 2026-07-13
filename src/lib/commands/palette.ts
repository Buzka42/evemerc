export type CommandId =
  | 'refresh-workspace'
  | 'layout-fleet-command'
  | 'layout-compact-fleet'
  | 'layout-scanning'
  | 'popout-fleet'
  | 'popout-chain'
  | 'popout-account'
  | 'popout-telemetry'
  | 'popout-system-intel'
  | 'toggle-wormhole'

export interface PaletteCommand {
  id: CommandId
  title: string
  keywords: string[]
}

export const paletteCommands: PaletteCommand[] = [
  { id: 'refresh-workspace', title: 'Refresh active workspace', keywords: ['sync', 'reload', 'fleet'] },
  { id: 'layout-fleet-command', title: 'Use Fleet Command layout', keywords: ['profile', 'primary'] },
  { id: 'layout-compact-fleet', title: 'Use Compact Fleet layout', keywords: ['profile', 'overlay'] },
  { id: 'layout-scanning', title: 'Use Scanning layout', keywords: ['profile', 'wormhole'] },
  { id: 'popout-fleet', title: 'Pop out Fleet Command', keywords: ['window', 'overlay', 'map'] },
  { id: 'popout-chain', title: 'Pop out Wormhole Chain', keywords: ['window', 'overlay', 'scan'] },
  { id: 'popout-account', title: 'Pop out Account', keywords: ['window', 'overlay', 'character', 'tokens'] },
  { id: 'popout-telemetry', title: 'Pop out Telemetry', keywords: ['window', 'overlay', 'logs', 'operations'] },
  { id: 'popout-system-intel', title: 'Pop out System Intel', keywords: ['window', 'overlay', 'kills', 'system'] },
  { id: 'toggle-wormhole', title: 'Toggle Wormhole Map module', keywords: ['module', 'chain'] },
]

export function filterPaletteCommands(query: string): PaletteCommand[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return paletteCommands

  return paletteCommands.filter((command) => (
    command.title.toLocaleLowerCase().includes(needle)
    || command.keywords.some((keyword) => keyword.includes(needle))
  ))
}
