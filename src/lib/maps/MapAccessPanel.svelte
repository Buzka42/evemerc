<script lang="ts">
  import type { EntityType, MapAccessList, MapPermission } from './access';

  interface Props {
    access: MapAccessList;
    message: string | null;
    onSetAccess: (entityId: number, entityType: EntityType, permission: MapPermission | null, expiresAt: string | null) => void;
  }

  let { access, message, onSetAccess }: Props = $props();

  const unGranted = $derived(access.candidates.filter((candidate) => candidate.permission === null && !candidate.isOwner));

  function handlePermissionChange(entityId: number, entityType: EntityType, value: string): void {
    onSetAccess(entityId, entityType, value === 'none' ? null : (value as MapPermission), null);
  }
</script>

<div class="border-t border-slate-700/70 pt-4">
  <p class="text-xs font-semibold tracking-[0.15em] text-slate-500">MAP ACCESS</p>
  <div class="mt-2 flex flex-col gap-1 text-xs">
    {#each access.entries as entry}
      <div class="flex items-center justify-between gap-2 rounded bg-slate-900/70 px-2 py-1.5">
        <span class="min-w-0 truncate">{entry.name} <span class="text-slate-600">· {entry.type}</span></span>
        {#if entry.isOwner}
          <span class="text-amber-300">owner</span>
        {:else}
          <select
            class="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
            value={entry.permission ?? 'none'}
            onchange={(event) => handlePermissionChange(entry.id, entry.type, (event.currentTarget as HTMLSelectElement).value)}
          >
            <option value="none">Revoked</option>
            <option value="viewer">Viewer</option>
            <option value="member">Member</option>
            <option value="manager">Manager</option>
          </select>
        {/if}
      </div>
    {/each}
    {#if access.entries.length === 0}<p class="text-slate-500">No characters, corporations, or alliances have access yet.</p>{/if}
  </div>

  {#if unGranted.length > 0}
    <p class="mt-3 text-[10px] font-semibold tracking-[0.14em] text-slate-500">GRANT ACCESS</p>
    <div class="mt-2 flex flex-col gap-1 text-xs">
      {#each unGranted as candidate}
        <div class="flex items-center justify-between gap-2 rounded bg-slate-900/50 px-2 py-1.5">
          <span class="min-w-0 truncate">{candidate.name} <span class="text-slate-600">· {candidate.type}</span></span>
          <select
            class="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
            value="none"
            onchange={(event) => handlePermissionChange(candidate.id, candidate.type, (event.currentTarget as HTMLSelectElement).value)}
          >
            <option value="none">Grant…</option>
            <option value="viewer">Viewer</option>
            <option value="member">Member</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      {/each}
    </div>
  {/if}
  {#if message}<p class="mt-2 text-xs text-amber-200">{message}</p>{/if}
</div>
