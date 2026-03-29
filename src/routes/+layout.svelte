<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from 'svelte';
  import { connections, loadConnections, activeConnection, activeConnectionId } from '$lib/stores/connection';
  import { activeDb } from '$lib/stores/database';
  import Logo from '$lib/components/common/Logo.svelte';
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

<div class="h-screen flex flex-col bg-[#f8f8f8] font-mono text-sm">
  <!-- Title Bar -->
  <div class="h-9 bg-[#f0f0f0] border-b border-[#d4d4d4] flex items-center px-4 select-none relative" style="-webkit-app-region: drag;">
    <div class="flex items-center gap-2">
      <Logo size={18} />
      <span class="text-[#1a1a1a] font-medium">Redim</span>
    </div>
    <ConnectionSwitcher />
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex overflow-hidden">
    {@render children()}
  </div>

  <!-- Status Bar -->
  <div class="h-6 bg-[#f0f0f0] border-t border-[#d4d4d4] flex items-center px-3 text-xs text-[#6b6b6b]">
    {#if $activeConnection}
      <span class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[#28c840]"></span>
        <span>{$activeConnection.name || $activeConnection.host}:{$activeConnection.port}</span>
        <span class="text-[#9a9a9a]">db{$activeDb}</span>
      </span>
    {:else}
      <span class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[#9a9a9a]"></span>
        disconnected
      </span>
    {/if}
    <span class="ml-auto flex items-center gap-3">
      {#if isConnected}
        <button 
          class="text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
          onclick={() => showImportExport = true}
          title="Import/Export"
        >
          ↕ data
        </button>
        <button 
          class="text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
          onclick={() => showMonitor = true}
          title="Monitor (⌘M)"
        >
          ◎ monitor
        </button>
        <button 
          class="text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
          onclick={() => showCli = true}
          title="CLI (⌘K)"
        >
          ⌘ cli
        </button>
      {/if}
      <span>v0.1.0</span>
    </span>
  </div>
</div>

<CliTerminal bind:open={showCli} onclose={() => showCli = false} />
<MonitorPanel bind:open={showMonitor} onclose={() => showMonitor = false} />
<ImportExport bind:open={showImportExport} onclose={() => showImportExport = false} />
