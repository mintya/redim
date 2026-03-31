<script lang="ts">
  import { connections, activeConnectionId, connect, disconnect } from '$lib/stores/connection';
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
  let alertTitle = $state('');
  let alertMessage = $state('');
  let connectedConnName = $state('');

  async function handleConnect(id: string, name: string) {
    if (connecting) return; // Prevent double-click while connecting
    connecting = id;
    connectedConnName = name;
    try {
      await connect(id);
    } catch (e) {
      alertTitle = 'Connection Error';
      alertMessage = formatError(String(e));
      showAlert = true;
    } finally {
      connecting = null;
    }
  }

  async function handleDisconnect(id: string) {
    await disconnect(id);
  }

  function formatError(err: string): string {
    if (err.includes('Connection refused')) return 'Connection refused. Please check host and port.';
    if (err.includes('timeout')) return 'Connection timed out. The server may be unreachable.';
    if (err.includes('Authentication')) return 'Authentication failed. Please check username and password.';
    if (err.includes('Connection reset')) return 'Connection was reset by the server.';
    return err;
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
    {@const isConnected = $activeConnectionId === conn.id}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="group px-4 py-3 cursor-pointer transition-colors border-b border-[#e5e5e5] {isConnected ? 'bg-[#fdf0ef]' : 'hover:bg-[#f0f0f0]'}"
      ondblclick={() => !isConnected && handleConnect(conn.id, conn.name || conn.host)}
      oncontextmenu={(e) => handleContextMenu(e, conn)}
      role="button"
      tabindex="0"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          {#if isConnected}
            <span class="w-1.5 h-1.5 rounded-full bg-[#28c840] flex-shrink-0"></span>
          {/if}
          <span class="text-base text-[#1a1a1a] font-mono truncate">{conn.name || conn.host}</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          {#if connecting === conn.id}
            <span class="text-base text-[#dc382d] animate-pulse">connecting...</span>
          {:else if isConnected}
            <button 
              class="text-base text-[#6b6b6b] hover:text-[#dc382d] transition-colors"
              onclick={() => handleDisconnect(conn.id)}
            >
              disconnect
            </button>
          {:else}
            <button 
              class="px-2 py-0.5 text-base text-[#dc382d] border border-[#dc382d] rounded hover:bg-[#dc382d] hover:text-white transition-colors"
              onclick={() => handleConnect(conn.id, conn.name || conn.host)}
            >
              connect
            </button>
          {/if}
        </div>
      </div>
      <div class="text-base text-[#9a9a9a] mt-0.5 font-mono">{conn.host}:{conn.port}</div>
    </div>
  {:else}
    <div class="px-4 py-8 text-center">
      <div class="text-base text-[#9a9a9a]">no connections</div>
    </div>
  {/each}
</div>
<div class="h-9 px-4 border-t border-[#d4d4d4] flex items-center">
  <span class="text-base text-[#9a9a9a]">click connect or double-click to connect</span>
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
  title="Delete Connection"
  message="Are you sure you want to delete this connection?"
  confirmText="Delete"
  danger={true}
  onconfirm={handleConfirmDelete}
  oncancel={handleCancelDelete}
/>

<Alert 
  bind:open={showAlert}
  title={alertTitle}
  message={alertMessage}
  type="error"
  onClose={() => showAlert = false}
/>
