<script lang="ts">
  import type { ChainSnapshot } from './types';

  interface Props {
    snapshot: ChainSnapshot;
    selectedSystemId: number | null;
    selectedConnectionId?: number | null;
    onSelect: (id: number) => void;
    onMove?: (id: number, x: number, y: number) => void;
    onSelectConnection?: (id: number) => void;
  }

  let {
    snapshot,
    selectedSystemId,
    selectedConnectionId = null,
    onSelect,
    onMove = () => undefined,
    onSelectConnection = () => undefined,
  }: Props = $props();
  let positions = $state(new Map<number, { x: number; y: number }>());
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let draggingId = $state<number | null>(null);
  let panning = $state(false);

  $effect(() => {
    positions = new Map(snapshot.systems.map((system, index) => [system.id, {
      x: Math.max(60, Math.min(3940, system.x || 100 + index * 150)),
      y: Math.max(50, Math.min(1550, system.y || 100 + (index % 2) * 140)),
    }]));
  });

  function connectionColor(massStatus: string | null, lifetimeStatus: string | null): string {
    if (massStatus === 'critical') return '#fb7185';
    if (massStatus === 'reduced') return '#f97316';
    if (lifetimeStatus === 'eol') return '#fbbf24';
    return '#64748b';
  }

  function systemColor(status: string | null): string {
    if (status === 'hostile') return '#7f1d1d';
    if (status === 'scanned') return '#164e63';
    if (status === 'unscanned') return '#422006';
    return '#0f172a';
  }

  function movePointer(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const scale = 1000 / Math.max(1, svg.clientWidth) / zoom;
    if (draggingId !== null) {
      const current = positions.get(draggingId);
      if (!current) return;
      positions = new Map(positions).set(draggingId, {
        x: Math.max(40, Math.min(3960, current.x + event.movementX * scale)),
        y: Math.max(20, Math.min(1580, current.y + event.movementY * scale)),
      });
    } else if (panning) {
      panX += event.movementX * (1000 / Math.max(1, svg.clientWidth));
      panY += event.movementY * (1000 / Math.max(1, svg.clientWidth));
    }
  }

  function finishPointer(): void {
    if (draggingId !== null) {
      const position = positions.get(draggingId);
      if (position) onMove(draggingId, Math.round(position.x), Math.round(position.y));
    }
    draggingId = null;
    panning = false;
  }
</script>

<div class="relative h-96 w-full overflow-hidden">
  <div class="absolute right-2 top-2 z-10 flex gap-1">
    <button aria-label="Zoom out chain" class="rounded bg-slate-900/90 px-2 py-1 text-xs" onclick={() => zoom = Math.max(0.45, zoom - 0.15)}>−</button>
    <button aria-label="Reset chain view" class="rounded bg-slate-900/90 px-2 py-1 text-xs" onclick={() => { zoom = 1; panX = 0; panY = 0; }}>100%</button>
    <button aria-label="Zoom in chain" class="rounded bg-slate-900/90 px-2 py-1 text-xs" onclick={() => zoom = Math.min(2.5, zoom + 0.15)}>+</button>
  </div>
  <svg
    class="h-full w-full touch-none"
    viewBox="0 0 1000 400"
    role="img"
    aria-label="Wormhole chain map"
    onpointermove={movePointer}
    onpointerup={finishPointer}
    onpointerleave={finishPointer}
  >
    <rect
      width="1000" height="400" fill="transparent"
      role="button" tabindex="0" aria-label="Pan wormhole chain map"
      onpointerdown={() => panning = true}
      onkeydown={(event) => {
        if (event.key === 'ArrowLeft') panX -= 20;
        if (event.key === 'ArrowRight') panX += 20;
        if (event.key === 'ArrowUp') panY -= 20;
        if (event.key === 'ArrowDown') panY += 20;
      }}
    />
    <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
      <g>
        {#each snapshot.connections as connection}
          {@const from = positions.get(connection.fromMapSolarsystemId)}
          {@const to = positions.get(connection.toMapSolarsystemId)}
          {#if from && to}
            <g
              role="button"
              tabindex="0"
              aria-label={`Select connection between ${connection.fromMapSolarsystemId} and ${connection.toMapSolarsystemId}`}
              onpointerdown={(event) => event.stopPropagation()}
              onclick={(event) => { event.stopPropagation(); onSelectConnection(connection.id); }}
              onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onSelectConnection(connection.id); } }}
            >
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" stroke-width="18" />
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={selectedConnectionId === connection.id ? '#67e8f9' : connectionColor(connection.massStatus, connection.lifetimeStatus)}
                stroke-width={connection.shipSize === 'frigate' ? 1.5 : 3}
                stroke-dasharray={connection.lifetimeStatus === 'eol' ? '8 5' : undefined}
              >
                <title>Mass {connection.massStatus ?? 'stable'} · Lifetime {connection.lifetimeStatus ?? 'stable'} · {connection.shipSize ?? 'unknown'} ships</title>
              </line>
            </g>
          {/if}
        {/each}
      </g>
      {#each snapshot.systems as system}
        {@const position = positions.get(system.id)}
        {#if position}
          <g
            transform={`translate(${position.x} ${position.y})`}
            role="button"
            tabindex="0"
            aria-label={`Select ${system.name ?? system.solarsystemId}`}
            onpointerdown={(event) => { event.stopPropagation(); draggingId = system.id; onSelect(system.id); }}
            onclick={() => onSelect(system.id)}
            onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && onSelect(system.id)}
          >
            <rect x="-55" y="-34" width="110" height="68" rx="9" fill={systemColor(system.status)} stroke={selectedSystemId === system.id ? '#67e8f9' : '#64748b'} stroke-width={selectedSystemId === system.id ? 3 : 2} />
            <text x="-47" y="-19" fill={system.pinned ? '#fbbf24' : '#64748b'} font-size="10">{system.pinned ? '★' : '·'}</text>
            <text y="-17" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">{system.alias ? `${system.alias} · ` : ''}{system.name ?? system.solarsystemId}</text>
            <text y="-2" text-anchor="middle" fill="#94a3b8" font-size="9">{system.wormholeClass ? `C${system.wormholeClass}` : system.security?.toFixed(1) ?? 'unknown'}{system.effectName ? ` · ${system.effectName}` : ''}</text>
            <text y="12" text-anchor="middle" fill="#94a3b8" font-size="9">{system.statics.join(' / ') || 'no statics'}</text>
            <text y="26" text-anchor="middle" fill={system.signatures.length > 0 ? '#67e8f9' : '#64748b'} font-size="9">{system.signatures.length} signatures · {system.status ?? 'unknown'}</text>
          </g>
        {/if}
      {/each}
    </g>
  </svg>
</div>
