<script lang="ts">
  import type { FleetMember } from '../fleet/status';
  import type { RegionTopology } from '../sde/bridge';
  import type { RegionalLayerData } from '../modules/types';
  import { buildRegionalMapModel } from './model';
  import RegionalMapLegend from './RegionalMapLegend.svelte';

  interface Props {
    topology: RegionTopology;
    members: FleetMember[];
    highlightedSystemId?: number | null;
    hoveredSystemId?: number | null;
    layers?: RegionalLayerData[];
    regionName?: string | null;
    onSelectSystem?: (systemId: number) => void;
  }

  let { topology, members, highlightedSystemId = null, hoveredSystemId = null, layers = [], regionName = null, onSelectSystem = () => undefined }: Props = $props();

  const model = $derived(buildRegionalMapModel(topology, members, layers));

  function securityColor(security: number): string {
    if (security >= 0.5) return '#67e8f9';
    if (security > 0) return '#fbbf24';
    return '#fb7185';
  }

  /** Green shade by fleet member count, matching the web app's tiering. */
  function fleetBadgeColor(count: number): string {
    if (count >= 7) return '#15803D';
    if (count >= 4) return '#22C55E';
    if (count >= 2) return '#4ADE80';
    return '#86EFAC';
  }

  function nodeRadius(isSelected: boolean, hasPilots: boolean): number {
    if (isSelected) return 10;
    if (hasPilots) return 9;
    return 7;
  }
</script>

<div class="relative h-full min-h-72 w-full">
  <svg class="h-full w-full" viewBox="0 0 1000 580" role="img" aria-label="Regional fleet positions">
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
      {@const sov = model.sovereignty.get(system.id)}
      {@const kills = model.killCounts.get(system.id)}
      {@const isSelected = highlightedSystemId === system.id}
      {@const isHovered = hoveredSystemId === system.id}
      {@const radius = nodeRadius(isSelected, pilots > 0)}
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
          {#if isHovered}
            <circle r={radius + 9} fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="3 2" opacity="0.85" />
          {/if}
          {#if isSelected}
            <circle r={radius + 6} fill="none" stroke="#60a5fa" stroke-width="1.5" opacity="0.6" />
          {/if}
          {#if pilots > 0}
            <circle r={radius + 4} fill="none" stroke={isSelected ? '#60a5fa' : fleetBadgeColor(pilots)} stroke-width="1" opacity="0.5" />
          {/if}
          {#if sov}
            <circle r={radius + 1} fill="none" stroke={sov.color} stroke-width="1.75">
              <title>{system.name}: {sov.label}</title>
            </circle>
          {/if}
          <circle r={radius} fill={isSelected ? '#1e3a5f' : '#0F1923'} stroke={securityColor(system.security)} stroke-width={isSelected ? 2 : 1.5} />

          {#if pilots > 0}
            <g transform={`translate(${-radius - 8}, ${radius + 4})`}>
              <circle r="9" fill={fleetBadgeColor(pilots)} />
              <text text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="#0F1923">{pilots}</text>
            </g>
          {/if}
          {#if kills && kills.shipKills > 0}
            <text x={-radius - 5} y="1" text-anchor="end" dominant-baseline="central" font-size="9" font-weight="700" fill="#fb7185">{kills.shipKills}</text>
          {/if}
          {#if kills && kills.npcKills > 0}
            <text x={radius + 5} y="1" text-anchor="start" dominant-baseline="central" font-size="9" fill="#9CA3AF">{kills.npcKills}</text>
          {/if}
          <text y="-14" text-anchor="middle" fill={isSelected ? '#93c5fd' : '#cbd5e1'} font-size="9" font-weight="600">{system.name}</text>
        </g>
      {/if}
    {/each}
  </svg>
  <RegionalMapLegend {regionName} />
</div>
