<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { activeConnectionId, loadConnections, deleteConnection } from '$lib/stores/connection';
  import { loadDatabases, loadKeys } from '$lib/stores/database';
  import type { ConnectionConfig } from '$lib/types';
  import ConnectionList from '$lib/components/connection/ConnectionList.svelte';
  import ConnectionForm from '$lib/components/connection/ConnectionForm.svelte';
  import DbList from '$lib/components/database/DbList.svelte';
  import KeyList from '$lib/components/database/KeyList.svelte';
  import KeyDetail from '$lib/components/database/KeyDetail.svelte';
  import Resizer from '$lib/components/common/Resizer.svelte';

  let isConnected = $state(false);
  let currentConnectionId = $state<string | null>(null);
  let editingConnection = $state<ConnectionConfig | null>(null);
  let leftPanelWidth = $state(350);
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
      leftPanelWidth = Math.min(280, windowWidth * 0.5);
    } else if (windowWidth < 1024) {
      leftPanelWidth = 300;
    } else {
      leftPanelWidth = 350;
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
  <!-- Connected View: Database Browser -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left: DB List + Keys -->
    <div class="flex flex-col bg-[var(--color-macos-surface)] overflow-hidden" style="width: {leftPanelWidth}px; min-width: 200px;">
      <DbList />
      <KeyList />
    </div>

    <!-- Resizer -->
    <Resizer onresize={handlePanelResize} />

    <!-- Right: Key Details -->
    <div class="flex-1 flex flex-col bg-[var(--color-macos-surface)] overflow-hidden min-w-0">
      <KeyDetail />
    </div>
  </div>
{:else}
  <!-- Disconnected View: Connection Manager -->
  <div class="flex-1 flex items-center justify-center p-4 sm:p-6">
    <div class="flex border border-[var(--color-macos-border)] rounded-xl w-full max-w-4xl h-[calc(100vh-120px)] bg-[var(--color-macos-surface)] shadow-sm overflow-hidden">
      <!-- Left: Connection List -->
      <div class="w-72 sm:w-80 border-r border-[var(--color-macos-border)] flex flex-col bg-[var(--color-macos-surface)] rounded-l-xl flex-shrink-0">
        <div class="h-10 px-4 border-b border-[var(--color-macos-border)] flex items-center">
          <span class="text-base text-[var(--color-macos-text-secondary)] font-medium">connections</span>
        </div>
        <ConnectionList onedit={handleEdit} ondelete={handleDelete} />
      </div>

      <!-- Right: New Connection Form -->
      <div class="flex-1 flex flex-col bg-[var(--color-macos-surface)] rounded-r-xl min-w-0">
        <ConnectionForm bind:editing={editingConnection} onsaved={handleSaved} />
      </div>
    </div>
  </div>
{/if}
