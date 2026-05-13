<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { activeConnectionId, deleteConnection } from '$lib/stores/connection';
  import { loadDatabases, loadKeys } from '$lib/stores/database';
  import type { ConnectionConfig } from '$lib/types';
  import ConnectionList from '$lib/components/connection/ConnectionList.svelte';
  import ConnectionForm from '$lib/components/connection/ConnectionForm.svelte';
  import DbList from '$lib/components/database/DbList.svelte';
  import KeyList from '$lib/components/database/KeyList.svelte';
  import KeyDetailWorkspace from '$lib/components/database/KeyDetailWorkspace.svelte';
  import Resizer from '$lib/components/common/Resizer.svelte';

  let isConnected = $state(false);
  let currentConnectionId = $state<string | null>(null);
  let editingConnection = $state<ConnectionConfig | null>(null);
  let leftPanelWidth = $state(340);
  let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);

  const unsubscribe = activeConnectionId.subscribe(async (id) => {
    isConnected = !!id;
    currentConnectionId = id;
    if (id) {
      await loadDatabases(id);
      await loadKeys(id);
    }
  });

  onMount(() => {
    window.addEventListener('resize', handleResize);
    handleResize();
  });

  onDestroy(() => {
    unsubscribe();
    window.removeEventListener('resize', handleResize);
  });

  function handleResize() {
    windowWidth = window.innerWidth;
    if (windowWidth < 768) {
      leftPanelWidth = Math.min(280, windowWidth * 0.52);
    } else if (windowWidth < 1024) {
      leftPanelWidth = 300;
    } else {
      leftPanelWidth = 340;
    }
  }

  function handleEdit(conn: ConnectionConfig) {
    editingConnection = conn;
  }

  async function handleDelete(id: string) {
    await deleteConnection(id);
  }

  function handleSaved() {
    editingConnection = null;
  }

  function handlePanelResize(width: number) {
    leftPanelWidth = width;
  }
</script>

{#if isConnected}
  <div class="flex-1 flex overflow-hidden min-h-0">
    <div class="flex flex-col overflow-hidden glass-pane glass-pane-right" style="width: {leftPanelWidth}px; min-width: 200px;">
      <DbList />
      <KeyList />
    </div>

    <Resizer onresize={handlePanelResize} />

    <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden glass-content">
      <KeyDetailWorkspace />
    </div>
  </div>
{:else}
  <div class="flex-1 flex overflow-hidden min-h-0">
    <div class="w-72 sm:w-80 flex flex-col flex-shrink-0 min-h-0 glass-pane glass-pane-right">
      <div class="h-9 px-3 flex items-center glass-subtle-divider-bottom">
        <span class="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wide">connections</span>
      </div>
      <ConnectionList onedit={handleEdit} ondelete={handleDelete} />
    </div>

    <div class="flex-1 flex flex-col min-w-0 min-h-0 glass-content">
      <ConnectionForm bind:editing={editingConnection} onsaved={handleSaved} />
    </div>
  </div>
{/if}
