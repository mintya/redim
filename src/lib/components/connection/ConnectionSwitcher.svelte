<script lang="ts">
  import { onDestroy } from 'svelte';
  import { connections, activeConnection, activeConnectionId, connect, disconnect } from '$lib/stores/connection';
  import { loadDatabases, loadKeys } from '$lib/stores/database';

  let showMenu = $state(false);
  let isConnected = $state(false);
  let currentConnectionId = $state<string | null>(null);

  const unsubscribe = activeConnectionId.subscribe(id => {
    isConnected = !!id;
    currentConnectionId = id;
  });

  onDestroy(() => {
    unsubscribe();
  });

  async function handleSwitch(id: string) {
    if (id === currentConnectionId) {
      showMenu = false;
      return;
    }
    if (currentConnectionId) {
      await disconnect(currentConnectionId);
    }
    const success = await connect(id);
    if (success) {
      await loadDatabases(id);
      await loadKeys(id);
    }
    showMenu = false;
  }

  async function handleDisconnect() {
    if (currentConnectionId) {
      await disconnect(currentConnectionId);
      showMenu = false;
    }
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }

  function closeMenu() {
    showMenu = false;
  }
</script>

{#if isConnected}
  <div class="ml-auto flex items-center gap-2" style="-webkit-app-region: no-drag;">
    <button 
      class="px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-md transition-colors flex items-center gap-1"
      onclick={toggleMenu}
    >
      <span>{$activeConnection?.name || $activeConnection?.host}:{$activeConnection?.port}</span>
      <span class="text-[var(--color-text-tertiary)]">▾</span>
    </button>
    
    {#if showMenu}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="absolute right-4 top-9 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-md)] z-50"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="py-1">
          {#each $connections as conn}
            <button 
              class="w-full px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors flex items-center justify-between"
              onclick={() => handleSwitch(conn.id)}
            >
              <div>
                <div class="text-sm text-[var(--color-text-primary)]">{conn.name || conn.host}</div>
                <div class="text-xs text-[var(--color-text-tertiary)]">{conn.host}:{conn.port}</div>
              </div>
              {#if conn.id === currentConnectionId}
                <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-string)]"></span>
              {:else}
                <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]"></span>
              {/if}
            </button>
          {/each}
        </div>
        <div class="border-t border-[var(--color-border)] py-1">
          <button 
            class="w-full px-3 py-2 text-left text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors"
            onclick={handleDisconnect}
          >
            disconnect
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if showMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" onclick={closeMenu}></div>
{/if}
