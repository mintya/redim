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
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { check } from '@tauri-apps/plugin-updater';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { toast } from '$lib/stores/toast';
  import { updateState, setAvailableUpdate } from '$lib/stores/update';
  import { ArrowUpDown, Activity, Terminal, ArrowUpCircle } from '@lucide/svelte';

  const RELEASE_URL = 'https://github.com/mintya/redim/releases/latest';
  const AUTO_CHECK_DELAY_MS = 4000;
  const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

  let { children } = $props();

  let isConnected = $state(false);
  let showCli = $state(false);
  let showMonitor = $state(false);
  let showImportExport = $state(false);
  let unlistenCheckUpdates: UnlistenFn | null = null;
  let checkingUpdates = $state(false);
  let autoCheckTimer: ReturnType<typeof setTimeout> | null = null;
  let autoCheckInterval: ReturnType<typeof setInterval> | null = null;

  const unsubscribe = activeConnectionId.subscribe((id) => {
    isConnected = !!id;
  });

  onMount(() => {
    loadConnections();
    window.addEventListener('keydown', handleGlobalKeydown);
    listen('redim://check-updates', () => {
      void handleCheckUpdates();
    }).then((unlisten) => {
      unlistenCheckUpdates = unlisten;
    });
    autoCheckTimer = setTimeout(() => {
      void runBackgroundUpdateCheck();
    }, AUTO_CHECK_DELAY_MS);
    autoCheckInterval = setInterval(() => {
      void runBackgroundUpdateCheck();
    }, AUTO_CHECK_INTERVAL_MS);
  });

  onDestroy(() => {
    unsubscribe();
    unlistenCheckUpdates?.();
    window.removeEventListener('keydown', handleGlobalKeydown);
    if (autoCheckTimer) clearTimeout(autoCheckTimer);
    if (autoCheckInterval) clearInterval(autoCheckInterval);
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

  async function handleCheckUpdates() {
    if (checkingUpdates) return;
    checkingUpdates = true;
    toast.info('Checking for updates…');
    try {
      const update = await check();
      if (update) {
        await setAvailableUpdate(update);
        toast.success(`Update available: ${update.version}`, 7000);
      } else {
        await setAvailableUpdate(null);
        toast.success('Redim is up to date');
      }
    } catch (e) {
      toast.error(`Failed to check for updates: ${String(e)}`);
    } finally {
      checkingUpdates = false;
    }
  }

  async function runBackgroundUpdateCheck() {
    if (checkingUpdates) return;
    try {
      const update = await check();
      await setAvailableUpdate(update ?? null);
    } catch (e) {
      console.warn('background update check failed', e);
    }
  }

  async function handleOpenRelease() {
    try {
      await openUrl(RELEASE_URL);
    } catch (e) {
      toast.error(`Failed to open release page: ${String(e)}`);
    }
  }
</script>

<div class="h-screen flex flex-col font-sans app-shell">
  <div class="h-10 flex items-center px-3 select-none relative glass-titlebar glass-border app-toolbar">
    <div class="flex items-center gap-2">
      <Logo size={16} />
      <span class="ui-title tracking-tight">Redim</span>
    </div>
    <ConnectionSwitcher />
  </div>

  <div class="flex-1 flex overflow-hidden min-h-0">
    {@render children()}
  </div>

  <div class="h-7 flex items-center px-3 text-xs text-[var(--color-text-secondary)] glass-statusbar">
    {#if $activeConnection}
      <span class="flex items-center gap-2 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-string)]"></span>
        <span class="text-[var(--color-text-primary)] font-medium truncate max-w-[240px]">{$activeConnection.name || $activeConnection.host}:{$activeConnection.port}</span>
        <span class="text-[var(--color-text-tertiary)]">db{$activeDb}</span>
      </span>
    {:else}
      <span class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]"></span>
        <span class="text-[var(--color-text-tertiary)]">Disconnected</span>
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
          <span>Data</span>
        </button>
        <button
          class="ui-btn ui-btn-ghost ui-btn-sm"
          onclick={() => (showMonitor = true)}
          title="Monitor (⌘M)"
        >
          <Activity class="w-3 h-3" />
          <span>Info</span>
        </button>
        <button
          class="ui-btn ui-btn-ghost ui-btn-sm"
          onclick={() => (showCli = true)}
          title="CLI (⌘K)"
        >
          <Terminal class="w-3 h-3" />
          <span>CLI</span>
        </button>
      {/if}
      {#if $updateState.available}
        <button
          class="ui-btn ui-btn-ghost ui-btn-sm update-indicator"
          onclick={handleOpenRelease}
          title="Update available: v{$updateState.version} (click to open release)"
          aria-label="Update available"
        >
          <ArrowUpCircle class="w-3 h-3" />
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

<style>
  .update-indicator {
    color: var(--color-accent);
    position: relative;
  }
  .update-indicator::after {
    content: '';
    position: absolute;
    top: 2px;
    right: 2px;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: var(--color-accent);
    box-shadow: 0 0 0 1.5px var(--color-glass-elevated, rgba(255, 255, 255, 0.9));
  }
</style>
