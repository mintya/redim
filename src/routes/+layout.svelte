<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { loadConnections, activeConnection, activeConnectionId } from '$lib/stores/connection';
  import { activeDb } from '$lib/stores/database';
  import Logo from '$lib/components/common/Logo.svelte';
  import ToastContainer from '$lib/components/common/ToastContainer.svelte';
  import LoadingIndicator from '$lib/components/common/LoadingIndicator.svelte';
  import ConnectionSwitcher from '$lib/components/connection/ConnectionSwitcher.svelte';
  import CliTerminal from '$lib/components/cli/CliTerminal.svelte';
  import MonitorPanel from '$lib/components/monitor/MonitorPanel.svelte';
  import ImportExport from '$lib/components/import/ImportExport.svelte';
  import { ArrowUpDown, Activity, Terminal } from '@lucide/svelte';

  let { children } = $props();

  let isConnected = $state(false);
  let showCli = $state(false);
  let showMonitor = $state(false);
  let showImportExport = $state(false);

  const unsubscribe = activeConnectionId.subscribe((id) => {
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (isConnected) showCli = !showCli;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
      e.preventDefault();
      if (isConnected) showMonitor = !showMonitor;
    }
  }
</script>

<div class="h-screen flex flex-col bg-[var(--color-bg-primary)] font-sans">
  <div class="h-10 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] flex items-center px-3 select-none relative" style="-webkit-app-region: drag;">
    <div class="flex items-center gap-2">
      <Logo size={16} />
      <span class="ui-title tracking-tight">Redim</span>
    </div>
    <ConnectionSwitcher />
  </div>

  <div class="flex-1 flex overflow-hidden min-h-0">
    {@render children()}
  </div>

  <div class="h-7 bg-[var(--color-bg-surface)] border-t border-[var(--color-border)] flex items-center px-3 text-xs text-[var(--color-text-secondary)]">
    {#if $activeConnection}
      <span class="flex items-center gap-2 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-string)]"></span>
        <span class="text-[var(--color-text-primary)] font-medium truncate max-w-[240px]">{$activeConnection.name || $activeConnection.host}:{$activeConnection.port}</span>
        <span class="text-[var(--color-text-tertiary)]">db{$activeDb}</span>
      </span>
    {:else}
      <span class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]"></span>
        <span class="text-[var(--color-text-tertiary)]">disconnected</span>
      </span>
    {/if}

    <span class="ml-auto flex items-center gap-1.5">
      {#if isConnected}
        <button
          class="ui-btn ui-btn-ghost ui-btn-sm"
          onclick={() => (showImportExport = true)}
          title="Import/Export"
        >
          <ArrowUpDown class="w-3 h-3" />
          <span>data</span>
        </button>
        <button
          class="ui-btn ui-btn-ghost ui-btn-sm"
          onclick={() => (showMonitor = true)}
          title="Monitor (⌘M)"
        >
          <Activity class="w-3 h-3" />
          <span>info</span>
        </button>
        <button
          class="ui-btn ui-btn-ghost ui-btn-sm"
          onclick={() => (showCli = true)}
          title="CLI (⌘K)"
        >
          <Terminal class="w-3 h-3" />
          <span>cli</span>
        </button>
      {/if}
      <span class="text-[var(--color-text-tertiary)]">v{__APP_VERSION__}</span>
    </span>
  </div>
</div>

<CliTerminal bind:open={showCli} onclose={() => (showCli = false)} />
<MonitorPanel bind:open={showMonitor} onclose={() => (showMonitor = false)} />
<ImportExport bind:open={showImportExport} onclose={() => (showImportExport = false)} />
<ToastContainer />
<LoadingIndicator />
