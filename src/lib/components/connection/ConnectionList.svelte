<script lang="ts">
  import { connections, activeConnectionId, connect, disconnect } from '$lib/stores/connection';
  import { toast } from '$lib/stores/toast';
  import type { ConnectionConfig } from '$lib/types';
  import ContextMenu from '$lib/components/common/ContextMenu.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';

  interface Props {
    onedit: (conn: ConnectionConfig) => void;
    ondelete: (id: string) => void;
  }

  let { onedit, ondelete }: Props = $props();

  let connecting = $state<string | null>(null);
  let contextMenu = $state<{ x: number; y: number; conn: ConnectionConfig } | null>(null);
  let showConfirm = $state(false);
  let pendingDeleteId = $state<string | null>(null);

  function formatError(err: string): string {
    if (err.includes('Connection refused')) return 'Connection refused. Please check host and port.';
    if (err.includes('timeout')) return 'Connection timed out. The server may be unreachable.';
    if (err.includes('Authentication')) return 'Authentication failed. Please check username and password.';
    if (err.includes('Connection reset')) return 'Connection was reset by the server.';
    return err;
  }

  async function handleConnect(id: string) {
    if (connecting) return;
    connecting = id;
    try {
      await connect(id);
    } catch (e) {
      toast.error(formatError(String(e)));
    } finally {
      connecting = null;
    }
  }

  async function handleDisconnect(id: string) {
    await disconnect(id);
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

<div class="flex-1 overflow-y-auto min-h-0">
  {#each $connections as conn}
    {@const isConnected = $activeConnectionId === conn.id}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="group px-3 py-2 cursor-pointer transition-colors glass-subtle-divider-bottom {isConnected ? 'bg-[var(--color-accent-soft)] glass-accent-stripe-left' : 'hover:bg-[var(--color-surface-hover)]'}"
      ondblclick={() => !isConnected && handleConnect(conn.id)}
      oncontextmenu={(e) => handleContextMenu(e, conn)}
      role="button"
      tabindex="0"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 {isConnected ? 'bg-[var(--color-type-string)]' : 'bg-[var(--color-text-tertiary)]'}"></span>
            <span class="text-xs text-[var(--color-text-primary)] font-medium truncate">{conn.name || conn.host}</span>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">{conn.host}:{conn.port}</div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          {#if connecting === conn.id}
            <span class="text-xs text-[var(--color-text-tertiary)]">Connecting…</span>
          {:else if isConnected}
            <button
              class="ui-btn ui-btn-ghost ui-btn-sm"
              onclick={() => handleDisconnect(conn.id)}
            >
              Disconnect
            </button>
          {:else}
            <button
              class="ui-btn ui-btn-primary ui-btn-sm"
              onclick={() => handleConnect(conn.id)}
            >
              Connect
            </button>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="px-4 py-6 text-center border-b border-[var(--color-border)]">
      <div class="text-xs text-[var(--color-text-tertiary)]">No connections</div>
      <div class="text-xs text-[var(--color-text-tertiary)] mt-1">Add your first connection on the right panel.</div>
    </div>
  {/each}
</div>

<div class="h-7 px-3 border-t border-[var(--color-border)] flex items-center">
  <span class="text-xs text-[var(--color-text-tertiary)]">Double-click to connect</span>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={[
      { label: 'Edit', action: () => { onedit(contextMenu!.conn); closeContextMenu(); } },
      { label: 'Delete', action: () => handleDeleteClick(contextMenu!.conn.id), danger: true },
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
