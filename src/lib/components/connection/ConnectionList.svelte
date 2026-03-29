<script lang="ts">
  import { connections, activeConnectionId, connect } from '$lib/stores/connection';
  import type { ConnectionConfig } from '$lib/types';
  import ContextMenu from '$lib/components/common/ContextMenu.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';
  import Alert from '$lib/components/common/Alert.svelte';

  interface Props {
    onedit: (conn: ConnectionConfig) => void;
    ondelete: (id: string) => void;
  }

  let { onedit, ondelete }: Props = $props();

  let connecting = $state<string | null>(null);
  let contextMenu = $state<{ x: number; y: number; conn: ConnectionConfig } | null>(null);
  let showConfirm = $state(false);
  let pendingDeleteId = $state<string | null>(null);
  let showAlert = $state(false);
  let alertMessage = $state('');
  let connectedConnName = $state('');

  async function handleConnect(id: string, name: string) {
    connecting = id;
    connectedConnName = name;
    try {
      await connect(id);
    } catch (e) {
      alertMessage = `Connection failed: ${e}`;
      showAlert = true;
    } finally {
      connecting = null;
    }
  }

  function handleContextMenu(e: MouseEvent, conn: ConnectionConfig) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, conn };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function handleDeleteClick(id: string) {
    pendingDeleteId = id;
    showConfirm = true;
    closeContextMenu();
  }

  function handleConfirmDelete() {
    if (pendingDeleteId) {
      ondelete(pendingDeleteId);
      pendingDeleteId = null;
    }
  }

  function handleCancelDelete() {
    pendingDeleteId = null;
  }
</script>

<div class="flex-1 overflow-y-auto">
  {#each $connections as conn}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="group px-4 py-3 cursor-pointer transition-colors border-b border-[#e5e5e5] hover:bg-[#f0f0f0]"
      ondblclick={() => handleConnect(conn.id, conn.name || conn.host)}
      oncontextmenu={(e) => handleContextMenu(e, conn)}
      role="button"
      tabindex="0"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm text-[#1a1a1a] font-mono truncate">{conn.name || conn.host}</span>
        {#if connecting === conn.id}
          <span class="text-xs text-[#dc382d] animate-pulse">connecting...</span>
        {/if}
      </div>
      <div class="text-xs text-[#9a9a9a] mt-0.5 font-mono">{conn.host}:{conn.port}</div>
    </div>
  {:else}
    <div class="px-4 py-8 text-center">
      <div class="text-xs text-[#9a9a9a]">no connections</div>
    </div>
  {/each}
</div>
<div class="h-8 px-4 border-t border-[#d4d4d4] flex items-center">
  <span class="text-xs text-[#9a9a9a]">double-click to connect</span>
</div>

{#if contextMenu}
  <ContextMenu 
    x={contextMenu.x} 
    y={contextMenu.y} 
    items={[
      { label: 'edit', action: () => { onedit(contextMenu!.conn); closeContextMenu(); } },
      { label: 'delete', action: () => handleDeleteClick(contextMenu!.conn.id), danger: true },
    ]}
    onclose={closeContextMenu}
  />
{/if}

<Confirm 
  bind:open={showConfirm}
  title="delete connection"
  message="确定要删除这个连接吗？"
  confirmText="delete"
  danger={true}
  onconfirm={handleConfirmDelete}
  oncancel={handleCancelDelete}
/>

<Alert 
  bind:open={showAlert}
  title="connection error"
  message={alertMessage}
  type="error"
  onClose={() => showAlert = false}
/>
