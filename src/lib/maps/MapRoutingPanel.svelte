<script lang="ts">
  import type { MapRoutingSettings } from './settings';

  interface Props {
    settings: MapRoutingSettings;
    message: string | null;
    serverUrl: string;
    onSave: () => void;
    onTogglePublic: () => void;
    onChangeShareToken: (revoke: boolean) => void;
  }

  let { settings = $bindable(), message, serverUrl, onSave, onTogglePublic, onChangeShareToken }: Props = $props();
</script>

<div class="border-t border-slate-700/70 pt-4">
  <p class="text-xs font-semibold tracking-[0.15em] text-slate-500">MAP & ROUTING</p>
  <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
    <select aria-label="Route preference" class="rounded border border-slate-700 bg-slate-900 px-2 py-1" bind:value={settings.routePreference}>
      <option value="shorter">Shortest</option><option value="safer">Safer</option><option value="less_secure">Less secure</option>
    </select>
    <label class="flex items-center gap-2 rounded bg-slate-900/70 px-2 py-1">Security penalty <input class="w-14 bg-transparent text-right" type="number" min="0" max="100" bind:value={settings.securityPenalty} /></label>
    <label class="flex items-center gap-2"><input type="checkbox" bind:checked={settings.routeUseEveScout} /> EVE Scout routes</label>
    <label class="flex items-center gap-2"><input type="checkbox" bind:checked={settings.trackingAllowed} /> Position tracking</label>
  </div>
  <div class="mt-2 flex flex-wrap gap-2">
    <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onSave}>Save routing</button>
    {#if settings.canManageAccess}
      <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onTogglePublic}>{settings.isPublic ? 'Make private' : 'Make public'}</button>
      <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={() => onChangeShareToken(settings.shareToken !== null)}>{settings.shareToken ? 'Revoke share link' : 'Create share link'}</button>
    {/if}
  </div>
  {#if settings.shareToken}<code class="mt-2 block select-all break-all text-[10px] text-cyan-200">{serverUrl}/maps/shared/{settings.shareToken}</code>{/if}
  {#if message}<p class="mt-2 text-xs text-amber-200">{message}</p>{/if}
</div>
