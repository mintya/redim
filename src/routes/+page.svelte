<script lang="ts">
  import { onDestroy } from 'svelte';
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
  let leftPanelWidth = $state(350); // 默认宽度

  const unsubscribe = activeConnectionId.subscribe(async (id) => {
    isConnected = !!id;
    currentConnectionId = id;
    if (id) {
      await loadDatabases(id);
      await loadKeys(id);
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  function handleEdit(conn: ConnectionConfig) {
    editingConnection = conn;
  }

  async function handleDelete(id: string) {
    await deleteConnection(id);
  }

  function handleSaved() {
    editingConnection = null;
  }

  function handleResize(width: number) {
    leftPanelWidth = width;
  }
</script>

{#if isConnected}
  <!-- Connected View: Database Browser -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left: DB List + Keys -->
    <div class="flex flex-col bg-[#fafafa] overflow-hidden" style="width: {leftPanelWidth}px">
      <DbList />
      <KeyList />
    </div>

    <!-- Resizer -->
    <Resizer onresize={handleResize} />

    <!-- Right: Key Details -->
    <div class="flex-1 flex flex-col bg-[#fafafa] overflow-hidden">
      <KeyDetail />
    </div>
  </div>
{:else}
  <!-- Disconnected View: Connection Manager -->
  <div class="flex-1 flex items-center justify-center p-6">
    <div class="flex border border-[#d4d4d4] rounded w-full max-w-4xl h-[calc(100vh-120px)]">
      <!-- Left: Connection List -->
      <div class="w-80 border-r border-[#d4d4d4] flex flex-col bg-[#fafafa] rounded-l">
        <div class="h-11 px-4 border-b border-[#d4d4d4] flex items-center">
          <span class="text-base text-[#6b6b6b] font-mono">connections</span>
        </div>
        <ConnectionList onedit={handleEdit} ondelete={handleDelete} />
      </div>

      <!-- Right: New Connection Form -->
      <div class="flex-1 flex flex-col bg-[#fafafa] rounded-r">
        <ConnectionForm bind:editing={editingConnection} onsaved={handleSaved} />
      </div>
    </div>
  </div>
{/if}
