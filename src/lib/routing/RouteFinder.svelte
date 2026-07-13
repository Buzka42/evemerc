<script lang="ts">
  import type { ClosestCondition, LifetimeStatus, MassStatus, RouteResult, RoutePreference, RoutingSettings } from './pathfinder';

  interface Props {
    fromId: string;
    toId: string;
    mode: 'point-to-point' | 'closest-of-type';
    condition: ClosestCondition;
    settings: RoutingSettings;
    result: RouteResult | null;
    closestResults: { solarsystemId: number; jumps: number }[];
    error: string | null;
    onFindRoute: () => void;
    onFindClosest: () => void;
  }

  let {
    fromId = $bindable(),
    toId = $bindable(),
    mode = $bindable(),
    condition = $bindable(),
    settings = $bindable(),
    result,
    closestResults,
    error,
    onFindRoute,
    onFindClosest,
  }: Props = $props();

  const routePreferences: RoutePreference[] = ['shorter', 'safer', 'less_secure'];
  const massStatuses: MassStatus[] = ['fresh', 'reduced', 'critical'];
  const lifetimeStatuses: LifetimeStatus[] = ['healthy', 'eol', 'critical'];
  const conditions: ClosestCondition[] = ['highsec', 'lowsec', 'nullsec'];
</script>

<div class="border-t border-border pt-4">
  <p class="hud-label">Route Finder</p>

  <div class="mt-2 flex gap-2 text-xs">
    <button
      class="rounded border px-2 py-1"
      class:border-cyan-300={mode === 'point-to-point'}
      class:text-cyan-200={mode === 'point-to-point'}
      class:border-slate-700={mode !== 'point-to-point'}
      onclick={() => (mode = 'point-to-point')}
    >Point to point</button>
    <button
      class="rounded border px-2 py-1"
      class:border-cyan-300={mode === 'closest-of-type'}
      class:text-cyan-200={mode === 'closest-of-type'}
      class:border-slate-700={mode !== 'closest-of-type'}
      onclick={() => (mode = 'closest-of-type')}
    >Closest of type</button>
  </div>

  <div class="mt-2 flex gap-2">
    <input class="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="From ID" bind:value={fromId} />
    {#if mode === 'point-to-point'}
      <input class="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="To ID" bind:value={toId} />
      <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onFindRoute}>Find route</button>
    {:else}
      <select class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" bind:value={condition}>
        {#each conditions as c}<option value={c}>{c}</option>{/each}
      </select>
      <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onFindClosest}>Search</button>
    {/if}
  </div>

  <div class="mt-2 grid grid-cols-3 gap-2 text-[11px]">
    <select class="rounded border border-slate-700 bg-slate-900 px-1 py-1" bind:value={settings.routePreference}>
      {#each routePreferences as p}<option value={p}>{p.replace('_', ' ')}</option>{/each}
    </select>
    <select class="rounded border border-slate-700 bg-slate-900 px-1 py-1" bind:value={settings.massStatus}>
      {#each massStatuses as m}<option value={m}>mass: {m}</option>{/each}
    </select>
    <select class="rounded border border-slate-700 bg-slate-900 px-1 py-1" bind:value={settings.lifetimeStatus}>
      {#each lifetimeStatuses as l}<option value={l}>life: {l}</option>{/each}
    </select>
  </div>
  {#if settings.routePreference !== 'shorter'}
    <div class="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
      <span>Security penalty</span>
      <input type="range" min="0" max="100" step="5" bind:value={settings.securityPenalty} class="flex-1" />
      <span>{settings.securityPenalty}%</span>
    </div>
  {/if}

  {#if error}<p class="mt-2 text-xs text-amber-200">{error}</p>{/if}

  {#if mode === 'point-to-point' && result}
    {#if result.route.length > 0}
      <div class="mt-3 flex flex-wrap gap-1 text-[11px]">
        {#each result.route as step, index}
          <span class="rounded bg-slate-900/70 px-2 py-0.5" class:text-cyan-200={step.via === 'wormhole'}>{step.id}</span>
          {#if index < result.route.length - 1}<span class="text-slate-600">→</span>{/if}
        {/each}
      </div>
      <p class="mt-1 text-[11px] text-slate-500">{result.jumps} jumps</p>
    {:else}
      <p class="mt-2 text-xs text-slate-500">No route found.</p>
    {/if}
  {/if}

  {#if mode === 'closest-of-type'}
    <div class="mt-3 flex flex-col gap-1">
      {#each closestResults as system}
        <div class="flex items-center justify-between rounded bg-slate-900/70 px-2 py-1 text-xs">
          <span>{system.solarsystemId}</span>
          <span class="text-slate-500">{system.jumps} jumps</span>
        </div>
      {/each}
      {#if closestResults.length === 0}<p class="text-xs text-slate-500">No matching systems found.</p>{/if}
    </div>
  {/if}
</div>
