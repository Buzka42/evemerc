<script lang="ts">
  import type { FleetMember } from '../fleet/status';
  import type { RegionTopology } from '../sde/bridge';
  import type { RegionalLayerData } from '../modules/types';
  import { buildRegionalMapModel } from './model';

  interface Props {
    topology: RegionTopology;
    members: FleetMember[];
    highlightedSystemId?: number | null;
    layers?: RegionalLayerData[];
    onSelectSystem?: (systemId: number) => void;
  }

  let { topology, members, highlightedSystemId = null, layers = [], onSelectSystem = () => undefined }: Props = $props();

  const model = $derived(buildRegionalMapModel(topology, members, layers));

  function securityColor(security: number): string {
    if (security >= 0.5) return '#67e8f9';
    if (security > 0) return '#fbbf24';
    return '#fb7185';
  }
</script>

<svg class="h-full min-h-72 w-full" viewBox="0 0 1000 580" role="img" aria-label="Regional fleet positions">
  <g stroke="#334155" stroke-opacity="0.55" stroke-width="1.5">
    {#each topology.jumps.filter((jump) => jump.fromSystemId < jump.toSystemId) as jump}
      {@const from = model.positions.get(jump.fromSystemId)}
      {@const to = model.positions.get(jump.toSystemId)}
      {#if from && to}
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      {/if}
    {/each}
  </g>
  {#each topology.systems as system}
    {@const position = model.positions.get(system.id)}
    {@const pilots = model.pilotCounts.get(system.id) ?? 0}
    {@const intel = model.intelIndicators.get(system.id)}
    {#if position}
      <g
        transform={`translate(${position.x} ${position.y})`}
        role="button"
        tabindex="0"
        aria-label={`Inspect ${system.name}`}
        onclick={() => onSelectSystem(system.id)}
        onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectSystem(system.id); }}
      >
        {#if intel}
          <circle r={10 + intel.intensity * 20} fill={intel.color} fill-opacity="0.12" stroke={intel.color} stroke-opacity="0.75">
            <title>{system.name}: {intel.label}</title>
          </circle>
        {/if}
        {#if highlightedSystemId === system.id}
          <circle r="22" fill="#fbbf24" fill-opacity="0.12" stroke="#fbbf24" stroke-width="3" stroke-dasharray="4 3" />
        {/if}
        {#if pilots > 0}
          <circle r="15" fill="#22d3ee" fill-opacity="0.18" stroke="#22d3ee" stroke-width="2" />
        {/if}
        <circle r="5" fill={securityColor(system.security)} />
        <text y="-9" text-anchor="middle" fill="#cbd5e1" font-size="10">{system.name}</text>
        {#if pilots > 0}
          <text y="4" text-anchor="middle" fill="#ecfeff" font-size="9" font-weight="700">{pilots}</text>
        {/if}
      </g>
    {/if}
  {/each}
</svg>
