<script lang="ts">
  import { memberFreshness } from './freshness';
  import type { FleetSnapshot } from './status';

  interface Props {
    snapshot: FleetSnapshot;
    onHoverMember?: (systemId: number | null) => void;
  }

  let { snapshot, onHoverMember = () => undefined }: Props = $props();
</script>

<div class="mt-3 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
  {#each snapshot.members as member}
    {@const freshness = memberFreshness(member, Date.now(), snapshot.freshness.staleAfterSeconds)}
    <div
      class="rounded-md bg-slate-900/80 p-3 text-xs"
      role="presentation"
      onmouseenter={() => onHoverMember(member.solar_system_id ?? null)}
      onmouseleave={() => onHoverMember(null)}
    >
      <div class="flex items-center justify-between gap-2">
        <p class="font-medium text-slate-200">{member.character_name ?? `Pilot ${member.character_id ?? 'unknown'}`}</p>
        <span
          class:text-emerald-300={freshness.state === 'current'}
          class:text-amber-300={freshness.state === 'stale'}
          class="text-slate-500"
        >{freshness.ageSeconds === null ? 'unknown' : `${freshness.ageSeconds}s`}</span>
      </div>
      <p class="mt-1 text-slate-500">System {member.solar_system_id ?? 'unknown'} · {member.ship_type_name ?? `Ship ${member.ship_type_id ?? 'unknown'}`}</p>
      <p class="mt-1 text-slate-600">{member.role ?? 'role unknown'} · {member.source ?? 'source unknown'} · {member.location_state ?? 'confirmed'}</p>
    </div>
  {/each}
  {#if snapshot.members.length === 0}
    <p class="text-sm text-slate-500">No active fleet registration for this map.</p>
  {/if}
</div>
