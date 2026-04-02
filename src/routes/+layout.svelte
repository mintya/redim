<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from 'svelte';
  import { connections, loadConnections, activeConnection, activeConnectionId } from '$lib/stores/connection';
  import { activeDb } from '$lib/stores/database';
  import Logo from '$lib/components/common/Logo.svelte';
  import ToastContainer from '$lib/components/common/ToastContainer.svelte';
  import LoadingIndicator from '$lib/components/common/LoadingIndicator.svelte';
  import ConnectionSwitcher from '$lib/components/connection/ConnectionSwitcher.svelte';
  import CliTerminal from '$lib/components/cli/CliTerminal.svelte';
  import MonitorPanel from '$lib/components/monitor/MonitorPanel.svelte';
  import ImportExport from '$lib/components/import/ImportExport.svelte';

  let { children } = $props();

  let isConnected = $state(false);
  let showCli = $state(false);
  let showMonitor = $state(false);
  let showImportExport = $state(false);

  const unsubscribe = activeConnectionId.subscribe(id => {
    isConnected = !!id;
  });

  onMount(() => {
    loadConnections();
    window.addEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(() => {
    unsubscribe();
    window.removeEventListener('keydown', handleGlobalKeydown);
  });

  function handleGlobalKeydown(e: KeyboardEvent) {
    // Cmd/Ctrl + K 打开 CLI
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (isConnected) {
        showCli = !showCli;
      }
    }
    // Cmd/Ctrl + M 打开 Monitor
    if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
      e.preventDefault();
      if (isConnected) {
        showMonitor = !showMonitor;
      }
    }
  }
</script>

<div class="h-screen flex flex-col bg-[var(--color-macos-bg)] font-mono text-base">
  <!-- Title Bar -->
  <div class="h-12 bg-[var(--color-macos-surface)] border-b border-[var(--color-macos-border)] flex items-center px-4 select-none relative" style="-webkit-app-region: drag;">
    <div class="flex items-center gap-2">
      <Logo size={24} />
      <span class="text-lg text-[var(--color-macos-text)] font-semibold">Redim</span>
    </div>
    <ConnectionSwitcher />
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex overflow-hidden">
    {@render children()}
  </div>

  <!-- Status Bar -->
  <div class="h-7 bg-[var(--color-macos-surface)] border-t border-[var(--color-macos-border)] flex items-center px-3 text-base text-[var(--color-macos-text-secondary)]">
    {#if $activeConnection}
      <span class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
        <span>{$activeConnection.name || $activeConnection.host}:{$activeConnection.port}</span>
        <span class="text-[var(--color-macos-text-tertiary)]">db{$activeDb}</span>
      </span>
    {:else}
      <span class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-macos-text-tertiary)]"></span>
        disconnected
      </span>
    {/if}
    <span class="ml-auto flex items-center gap-4">
      {#if isConnected}
        <button 
          class="text-[var(--color-macos-text-secondary)] hover:text-[var(--color-macos-text)] transition-colors"
          onclick={() => showImportExport = true}
          title="Import/Export"
        >
          ↕ data
        </button>
        <button 
          class="text-[var(--color-macos-text-secondary)] hover:text-[var(--color-macos-text)] transition-colors"
          onclick={() => showMonitor = true}
          title="Monitor (⌘M)"
        >
          ◎ monitor
        </button>
        <button 
          class="text-[var(--color-macos-text-secondary)] hover:text-[var(--color-macos-text)] transition-colors"
          onclick={() => showCli = true}
          title="CLI (⌘K)"
        >
          ⌘ cli
        </button>
      {/if}
      <span>v{__APP_VERSION__}</span>
    </span>
  </div>
</div>

<CliTerminal bind:open={showCli} onclose={() => showCli = false} />
<MonitorPanel bind:open={showMonitor} onclose={() => showMonitor = false} />
<ImportExport bind:open={showImportExport} onclose={() => showImportExport = false} />
<ToastContainer />
<LoadingIndicator />
