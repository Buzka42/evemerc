<script lang="ts">
  interface Props {
    fleetLinked: boolean;
    waypointSystemId: string;
    routeSystemInput: string;
    selectedSystemId: number | null;
    isSelectedSystemIgnored: boolean;
    commandMessage: string | null;
    onToggleRegistration: () => void;
    onSendWaypoint: () => void;
    onSendRoute: () => void;
    onToggleIgnored: () => void;
  }

  let {
    fleetLinked,
    waypointSystemId = $bindable(),
    routeSystemInput = $bindable(),
    selectedSystemId,
    isSelectedSystemIgnored,
    commandMessage,
    onToggleRegistration,
    onSendWaypoint,
    onSendRoute,
    onToggleIgnored,
  }: Props = $props();
</script>

<div class="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
  <button class="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950" onclick={onToggleRegistration}>
    {fleetLinked ? 'Unlink fleet' : 'Link current fleet'}
  </button>
  <input
    class="w-36 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
    inputmode="numeric"
    placeholder="System ID"
    bind:value={waypointSystemId}
  />
  <button class="rounded-md border border-cyan-300/30 px-3 py-2 text-xs text-cyan-100" onclick={onSendWaypoint}>
    Set fleet destination
  </button>
  <input class="w-56 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs" placeholder="Route system IDs: 1 > 2 > 3" bind:value={routeSystemInput} />
  <button class="rounded-md border border-cyan-300/30 px-3 py-2 text-xs text-cyan-100" onclick={onSendRoute}>Send route</button>
  <button
    class="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
    disabled={selectedSystemId === null}
    onclick={onToggleIgnored}
  >{isSelectedSystemIgnored ? 'Unignore selected' : 'Ignore selected'}</button>
  {#if commandMessage}<span class="text-xs text-amber-200">{commandMessage}</span>{/if}
</div>
