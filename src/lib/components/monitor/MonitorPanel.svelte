<script lang="ts">
  import { RotateCw, X } from '@lucide/svelte';
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open = $bindable(), onclose }: Props = $props();

  let rawInfo = $state('');
  let serverInfo = $state<Record<string, string> | null>(null);
  let error = $state('');
  let loading = $state(false);
  let showRawInfo = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let refreshIntervalSeconds = $state(5);
  const refreshOptions = [1, 5, 10, 30];

  async function loadInfo() {
    if (!$activeConnectionId) return;
    loading = true;
    error = '';
    try {
      const result = await invoke<string>('execute_command', { 
        id: $activeConnectionId, 
        args: ['INFO'].filter(Boolean)
      });
      rawInfo = result;
      serverInfo = parseInfo(result);
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function parseInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key) result[key] = value;
      }
    }
    return result;
  }

  function formatNumber(num: string | number): string {
    return Number(num).toLocaleString();
  }

  function getHitRate(): string {
    if (!serverInfo) return '0';
    const hits = Number(serverInfo.keyspace_hits || 0);
    const misses = Number(serverInfo.keyspace_misses || 0);
    const total = hits + misses;
    if (total === 0) return '0';
    return ((hits / total) * 100).toFixed(1);
  }

  function getDbStats() {
    if (!serverInfo) return {};
    const stats: Record<string, { keys: number; expires: number; avg_ttl: number }> = {};
    const keys = ['db0', 'db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7', 'db8', 'db9', 'db10', 'db11', 'db12', 'db13', 'db14', 'db15'];
    for (const db of keys) {
      const info = serverInfo[db];
      if (info) {
        const parts = info.split(',');
        let keys = 0, expires = 0, avg_ttl = 0;
        for (const part of parts) {
          const [k, v] = part.split('=');
          if (k === 'keys') keys = Number(v);
          else if (k === 'expires') expires = Number(v);
          else if (k === 'avg_ttl') avg_ttl = Math.round(Number(v) / 1000);
        }
        if (keys > 0) {
          stats[db] = { keys, expires, avg_ttl };
        }
      }
    }
    return stats;
  }

  let dbStats = $derived(getDbStats());

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    if (refreshIntervalSeconds > 0) {
      loadInfo();
      refreshInterval = setInterval(loadInfo, refreshIntervalSeconds * 1000);
    }
  }

  function handleClose() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    onclose();
  }

  $effect(() => {
    if (open && $activeConnectionId) {
      loadInfo();
      startAutoRefresh();
    }
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    };
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 bg-[var(--color-text-primary)]/10 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-[var(--shadow-md)]">
      <!-- Header -->
      <div class="h-10 px-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <span class="text-xs text-[var(--color-text-secondary)] font-sans uppercase tracking-wide">server info</span>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 bg-[var(--color-surface-hover)] rounded px-1">
            {#each refreshOptions as secs}
              <button 
                class="text-xs px-1.5 py-0.5 rounded transition-colors {refreshIntervalSeconds === secs ? 'bg-[var(--color-text-primary)] text-[var(--color-surface)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}"
                onclick={() => { refreshIntervalSeconds = secs; startAutoRefresh(); }}
              >
                {secs}s
              </button>
            {/each}
          </div>
          <button 
            class="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            onclick={() => showRawInfo = !showRawInfo}
          >
            {showRawInfo ? 'hide raw' : 'show raw'}
          </button>
          <button 
            class="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1"
            onclick={loadInfo}
          >
            <RotateCw class="w-3.5 h-3.5" />
            refresh
          </button>
          <button 
            class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            onclick={handleClose}
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if error}
          <div class="text-base text-[var(--color-accent)] mb-4">{error}</div>
        {/if}

        {#if showRawInfo && rawInfo}
          <div class="mb-4">
            <h3 class="text-base text-[var(--color-text-muted)] mb-2">raw INFO output</h3>
            <pre class="bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] p-3 rounded text-base font-mono overflow-x-auto max-h-60 overflow-y-auto">{rawInfo}</pre>
          </div>
        {/if}

        {#if serverInfo}
          <!-- Server Info -->
          <div class="mb-6">
            <h3 class="text-base text-[var(--color-text-muted)] mb-3">server</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">version</div>
                <div class="text-base text-[var(--color-text-primary)] font-sans">{serverInfo.redis_version}</div>
              </div>
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">uptime</div>
                <div class="text-base text-[var(--color-text-primary)] font-sans">{serverInfo.uptime_in_days} days</div>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="mb-6">
            <h3 class="text-base text-[var(--color-text-muted)] mb-3">stats</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">memory</div>
                <div class="text-lg text-[var(--color-text-primary)] font-sans">{serverInfo.used_memory_human}</div>
              </div>
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">clients</div>
                <div class="text-lg text-[var(--color-text-primary)] font-sans">{serverInfo.connected_clients}</div>
              </div>
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">ops/sec</div>
                <div class="text-lg text-[var(--color-text-primary)] font-sans">{serverInfo.instantaneous_ops_per_sec}</div>
              </div>
            </div>
          </div>

          <!-- Performance -->
          <div class="mb-6">
            <h3 class="text-base text-[var(--color-text-muted)] mb-3">performance</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">total commands</div>
                <div class="text-base text-[var(--color-text-primary)] font-sans">{formatNumber(serverInfo.total_commands_processed)}</div>
              </div>
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">total connections</div>
                <div class="text-base text-[var(--color-text-primary)] font-sans">{formatNumber(serverInfo.total_connections_received)}</div>
              </div>
              <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-3">
                <div class="text-base text-[var(--color-text-muted)]">hit rate</div>
                <div class="text-base text-[var(--color-type-string)] font-sans">{getHitRate()}%</div>
              </div>
            </div>
          </div>

          <!-- Keyspace -->
          <div>
            <h3 class="text-base text-[var(--color-text-muted)] mb-3">keyspace</h3>
            <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded overflow-hidden">
              <table class="w-full text-base font-sans">
                <thead>
                  <tr class="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                    <th class="text-left px-3 py-2 text-[var(--color-text-muted)]">database</th>
                    <th class="text-right px-3 py-2 text-[var(--color-text-muted)]">keys</th>
                    <th class="text-right px-3 py-2 text-[var(--color-text-muted)]">expires</th>
                    <th class="text-right px-3 py-2 text-[var(--color-text-muted)]">avg ttl</th>
                  </tr>
                </thead>
                <tbody>
                  {#each Object.entries(dbStats) as [db, stats]}
                    <tr class="border-b border-[var(--color-border)]">
                      <td class="px-3 py-2 text-[var(--color-text-primary)]">{db}</td>
                      <td class="px-3 py-2 text-[var(--color-text-primary)] text-right">{stats.keys}</td>
                      <td class="px-3 py-2 text-[var(--color-text-muted)] text-right">{stats.expires}</td>
                      <td class="px-3 py-2 text-[var(--color-text-muted)] text-right">{stats.avg_ttl}ms</td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="4" class="px-3 py-4 text-center text-[var(--color-text-muted)]">no data</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else if !error}
          <div class="text-center py-8 text-base text-[var(--color-text-muted)]">loading...</div>
        {/if}
      </div>
    </div>
  </div>
{/if}