<script lang="ts">
  import type { AccountCharacter, AccountToken } from './api';

  interface Props {
    characters: AccountCharacter[];
    tokens: AccountToken[];
    missingScopeNames: string[];
    newTokenName: string;
    createdTokenSecret: string | null;
    error: string | null;
    onRefresh: () => void;
    onPreferCharacter: (characterId: number) => void;
    onRemoveScopes: (characterId: number) => void;
    onRemoveCharacter: (characterId: number) => void;
    onIssueToken: () => void;
    onRevokeToken: (tokenId: number) => void;
    onDismissSecret: () => void;
    onAddScopes: () => void;
  }

  let {
    characters,
    tokens,
    missingScopeNames,
    newTokenName = $bindable(),
    createdTokenSecret,
    error,
    onRefresh,
    onPreferCharacter,
    onRemoveScopes,
    onRemoveCharacter,
    onIssueToken,
    onRevokeToken,
    onDismissSecret,
    onAddScopes,
  }: Props = $props();

  let confirmingRemoveId = $state<number | null>(null);

  function handleRemoveClick(characterId: number): void {
    if (confirmingRemoveId === characterId) {
      confirmingRemoveId = null;
      onRemoveCharacter(characterId);
    } else {
      confirmingRemoveId = characterId;
    }
  }
</script>

<div>
  <p class="hud-label">EVE ACCOUNT</p>
  {#if missingScopeNames.length > 0}
    <div class="mt-2 rounded border border-amber-300/30 bg-amber-300/10 p-2 text-xs text-amber-100">
      {missingScopeNames.join(', ')} {missingScopeNames.length === 1 ? 'is' : 'are'} missing the ESI
      scopes tracking needs. Use "Add ESI scopes" below to re-authorize.
    </div>
  {/if}
  <div class="mt-2 flex gap-2">
    <button class="rounded border border-slate-700 px-2 py-1 text-xs text-cyan-200" onclick={onAddScopes}>Add ESI scopes</button>
    <button class="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400" onclick={onRefresh}>Refresh</button>
  </div>
  <div class="mt-3 flex flex-col gap-2">
    {#each characters as character}
      <div class="rounded-md bg-slate-900/70 p-3 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-200">{character.name}</span>
          {#if character.isPreferred}
            <span class="text-emerald-300">preferred</span>
          {:else}
            <button class="text-cyan-200" onclick={() => onPreferCharacter(character.id)}>Use</button>
          {/if}
        </div>
        <div class="mt-2 flex items-center justify-between gap-2 text-slate-500">
          <span>{character.esiScopes.length} ESI scopes</span>
          {#if character.esiScopes.length > 0}
            <button class="text-amber-200" onclick={() => onRemoveScopes(character.id)}>Revoke</button>
          {/if}
        </div>
        <p class="mt-1 text-slate-400">{character.isOnline ? 'online' : 'offline'} · {character.solarSystemName ?? 'location unknown'} · {character.shipName ?? 'ship unknown'}</p>
        <p class="mt-1 text-slate-600">{character.locationSource ?? 'no source'} · {character.locationState ?? 'unknown'}</p>
        <div class="mt-2 flex justify-end">
          <button
            class="rounded border px-2 py-0.5 text-[11px]"
            class:border-rose-400={confirmingRemoveId === character.id}
            class:text-rose-300={confirmingRemoveId === character.id}
            class:border-slate-700={confirmingRemoveId !== character.id}
            class:text-slate-500={confirmingRemoveId !== character.id}
            onclick={() => handleRemoveClick(character.id)}
          >{confirmingRemoveId === character.id ? 'Confirm remove?' : 'Remove character'}</button>
        </div>
      </div>
    {/each}
    {#if characters.length === 0}<p class="text-xs text-slate-500">Loading characters…</p>{/if}
    {#if error}<p class="text-xs text-amber-200">{error}</p>{/if}
  </div>
  <div class="mt-3 border-t border-slate-700/70 pt-3">
    <p class="hud-label">API TOKENS</p>
    <div class="mt-2 flex gap-2">
      <input class="min-w-0 grow rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs" placeholder="Token name" bind:value={newTokenName} />
      <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onIssueToken}>Create</button>
    </div>
    {#if createdTokenSecret}
      <div class="mt-2 rounded border border-amber-300/30 bg-amber-300/10 p-2 text-xs text-amber-100">
        <p>Copy now; this token will not be shown again.</p>
        <code class="mt-1 block select-all break-all">{createdTokenSecret}</code>
        <button class="mt-1 text-slate-400" onclick={onDismissSecret}>Dismiss</button>
      </div>
    {/if}
    <div class="mt-2 flex flex-col gap-1">
      {#each tokens as token}
        <div class="flex items-center justify-between rounded bg-slate-900/70 px-2 py-1 text-xs">
          <span>{token.name}</span>
          <button class="text-amber-200" onclick={() => onRevokeToken(token.id)}>Revoke</button>
        </div>
      {/each}
    </div>
  </div>
</div>
