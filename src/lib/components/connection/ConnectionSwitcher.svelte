<script lang="ts">
  import { onDestroy } from 'svelte';
  import { connections, activeConnection, activeConnectionId, connect, disconnect } from '$lib/stores/connection';
  import { loadDatabases, loadKeys } from '$lib/stores/database';

  let showMenu = $state(false);
  let isConnected = $state(false);
  let currentConnectionId = $state<string | null>(null);
  let btnEl: HTMLButtonElement | null = $state(null);
  let menuEl: HTMLDivElement | null = $state(null);
  let menuPos = $state({ top: 0, right: 0 });

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

  function updateMenuPosition() {
    if (btnEl) {
      const rect = btnEl.getBoundingClientRect();
      menuPos = { top: rect.bottom + 4, right: window.innerWidth - rect.right };
    }
  }

  function toggleMenu() {
    showMenu = !showMenu;
    if (showMenu) updateMenuPosition();
  }

  function handleDocumentPointerDown(e: PointerEvent) {
    const target = e.target as Node | null;
    if (!target) return;
    if (menuEl?.contains(target)) return;
    if (btnEl?.contains(target)) return;
    showMenu = false;
  }

  function handleDocumentKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') showMenu = false;
  }

  $effect(() => {
    if (!showMenu) return;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    document.addEventListener('keydown', handleDocumentKeydown);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      document.removeEventListener('keydown', handleDocumentKeydown);
    };
  });
</script>

{#if isConnected}
  <div class="ml-auto flex items-center gap-2">
    <button
      bind:this={btnEl}
      class="ui-btn ui-btn-sm"
      onclick={toggleMenu}
    >
      <span class="truncate max-w-[220px]">{$activeConnection?.name || $activeConnection?.host}:{$activeConnection?.port}</span>
      <span class="text-[var(--color-text-tertiary)]">▾</span>
    </button>

    {#if showMenu}
      <div
        bind:this={menuEl}
        class="ui-menu-panel fixed w-56 z-[1000]"
        style="top: {menuPos.top}px; right: {menuPos.right}px;"
      >
        <div class="py-1">
          {#each $connections as conn}
            <button
              class="ui-menu-item"
              onclick={() => handleSwitch(conn.id)}
            >
              <div class="min-w-0">
                <div class="text-xs text-[var(--color-text-primary)] truncate">{conn.name || conn.host}</div>
                <div class="text-xs text-[var(--color-text-tertiary)] truncate">{conn.host}:{conn.port}</div>
              </div>
              <span class="w-1.5 h-1.5 rounded-full {conn.id === currentConnectionId ? 'bg-[var(--color-type-string)]' : 'bg-[var(--color-text-tertiary)]'}"></span>
            </button>
          {/each}
        </div>
        <div class="py-1 glass-subtle-divider-top">
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
