<script lang="ts">
  import { onDestroy } from 'svelte';
  import { connections, activeConnection, activeConnectionId, connect, disconnect } from '$lib/stores/connection';
  import { loadDatabases, loadKeys } from '$lib/stores/database';

  let showMenu = $state(false);
  let isConnected = $state(false);
  let currentConnectionId = $state<string | null>(null);

  const unsubscribe = activeConnectionId.subscribe((id) => {
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
      class="ui-btn ui-btn-sm"
      onclick={toggleMenu}
    >
      <span class="truncate max-w-[220px]">{$activeConnection?.name || $activeConnection?.host}:{$activeConnection?.port}</span>
      <span class="text-[var(--color-text-tertiary)]">▾</span>
    </button>

    {#if showMenu}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="ui-menu-panel absolute right-3 top-8 w-56 z-50"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="py-1">
          {#each $connections as conn}
            <button
              class="ui-menu-item"
              onclick={() => handleSwitch(conn.id)}
            >
              <div class="min-w-0">
                <div class="text-xs text-[var(--color-text-primary)] truncate">{conn.name || conn.host}</div>
                <div class="text-[11px] text-[var(--color-text-tertiary)] truncate">{conn.host}:{conn.port}</div>
              </div>
              <span class="w-1.5 h-1.5 rounded-full {conn.id === currentConnectionId ? 'bg-[var(--color-type-string)]' : 'bg-[var(--color-text-tertiary)]'}"></span>
            </button>
          {/each}
        </div>
        <div class="border-t border-[var(--color-border)] py-1">
          <button
            class="ui-menu-item ui-menu-item-danger"
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
