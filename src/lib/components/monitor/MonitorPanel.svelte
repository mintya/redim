<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open = $bindable(), onclose }: Props = $props();

  interface ServerInfo {
    redis_version: string;
    uptime_in_days: string;
    connected_clients: string;
    used_memory_human: string;
    total_connections_received: string;
    total_commands_processed: string;
    instantaneous_ops_per_sec: string;
    keyspace_hits: string;
    keyspace_misses: string;
  }

  interface DbStats {
    [key: string]: { keys: number; expires: number; avg_ttl: number };
  }

  let serverInfo = $state<ServerInfo | null>(null);
  let dbStats = $state<DbStats>({});
  let error = $state('');
  let refreshInterval = $state<number | null>(null);

  let rawInfo = $state('');
  let showRawInfo = $state(false);

  async function loadInfo() {
    if (!$activeConnectionId) return;
    
    try {
      const result = await invoke<string>('execute_command', {
        id: $activeConnectionId,
        args: ['INFO']
      });
      
      rawInfo = result;
      parseInfo(result);
      error = '';
    } catch (e) {
      error = String(e);
    }
  }

  function parseInfo(infoStr: string) {
    const lines = infoStr.split('\n');
    const info: Partial<ServerInfo> = {};
    const dbs: DbStats = {};

    for (const line of lines) {
      const [key, value] = line.split(':');
      if (!key || !value) continue;

      const trimmedKey = key.trim();
      const trimmedValue = value.trim();

      switch (trimmedKey) {
        case 'redis_version':
          info.redis_version = trimmedValue;
          break;
        case 'uptime_in_days':
          info.uptime_in_days = trimmedValue;
          break;
        case 'connected_clients':
          info.connected_clients = trimmedValue;
          break;
        case 'used_memory_human':
          info.used_memory_human = trimmedValue;
          break;
        case 'total_connections_received':
          info.total_connections_received = trimmedValue;
          break;
        case 'total_commands_processed':
          info.total_commands_processed = trimmedValue;
          break;
        case 'instantaneous_ops_per_sec':
          info.instantaneous_ops_per_sec = trimmedValue;
          break;
        case 'keyspace_hits':
          info.keyspace_hits = trimmedValue;
          break;
        case 'keyspace_misses':
          info.keyspace_misses = trimmedValue;
          break;
      }

      // Parse db stats
      if (trimmedKey.startsWith('db')) {
        const match = trimmedValue.match(/keys=(\d+),expires=(\d+),avg_ttl=(\d+)/);
        if (match) {
          dbs[trimmedKey] = {
            keys: parseInt(match[1]),
            expires: parseInt(match[2]),
            avg_ttl: parseInt(match[3])
          };
        }
      }
    }

    serverInfo = info as ServerInfo;
    dbStats = dbs;
  }

  function getHitRate(): string {
    if (!serverInfo) return '0';
    const hits = parseInt(serverInfo.keyspace_hits) || 0;
    const misses = parseInt(serverInfo.keyspace_misses) || 0;
    const total = hits + misses;
    if (total === 0) return '0';
    return ((hits / total) * 100).toFixed(2);
  }

  function formatNumber(num: string): string {
    const n = parseInt(num) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toString();
  }

  function handleClose() {
    stopAutoRefresh();
    open = false;
    onclose();
  }

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadInfo, 2000) as unknown as number;
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  $effect(() => {
    if (open) {
      // 使用 setTimeout 避免在 effect 中直接调用
      setTimeout(() => {
        loadInfo();
        startAutoRefresh();
      }, 0);
    }
    
    return () => {
      stopAutoRefresh();
    };
  });

  onDestroy(() => {
    stopAutoRefresh();
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[#f8f8f8] border border-[#d4d4d4] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-lg">
      <!-- Header -->
      <div class="h-10 px-4 border-b border-[#d4d4d4] flex items-center justify-between">
        <span class="text-xs text-[#1a1a1a] font-mono">monitor</span>
        <div class="flex items-center gap-2">
          <button 
            class="text-xs {showRawInfo ? 'text-[#dc382d]' : 'text-[#6b6b6b]'} hover:text-[#dc382d] transition-colors"
            onclick={() => showRawInfo = !showRawInfo}
          >
            {showRawInfo ? 'hide raw' : 'show raw'}
          </button>
          <button 
            class="text-xs text-[#6b6b6b] hover:text-[#dc382d] transition-colors"
            onclick={loadInfo}
          >
            ↻ refresh
          </button>
          <button 
            class="text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
            onclick={handleClose}
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if error}
          <div class="text-xs text-[#dc382d] mb-4">{error}</div>
        {/if}

        {#if showRawInfo && rawInfo}
          <div class="mb-4">
            <h3 class="text-xs text-[#6b6b6b] mb-2">raw INFO output</h3>
            <pre class="bg-[#1a1a1a] text-[#e0e0e0] p-3 rounded text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">{rawInfo}</pre>
          </div>
        {/if}

        {#if serverInfo}
          <!-- Server Info -->
          <div class="mb-6">
            <h3 class="text-xs text-[#6b6b6b] mb-3">server</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">version</div>
                <div class="text-sm text-[#1a1a1a] font-mono">{serverInfo.redis_version}</div>
              </div>
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">uptime</div>
                <div class="text-sm text-[#1a1a1a] font-mono">{serverInfo.uptime_in_days} days</div>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="mb-6">
            <h3 class="text-xs text-[#6b6b6b] mb-3">stats</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">memory</div>
                <div class="text-lg text-[#1a1a1a] font-mono">{serverInfo.used_memory_human}</div>
              </div>
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">clients</div>
                <div class="text-lg text-[#1a1a1a] font-mono">{serverInfo.connected_clients}</div>
              </div>
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">ops/sec</div>
                <div class="text-lg text-[#dc382d] font-mono">{serverInfo.instantaneous_ops_per_sec}</div>
              </div>
            </div>
          </div>

          <!-- Performance -->
          <div class="mb-6">
            <h3 class="text-xs text-[#6b6b6b] mb-3">performance</h3>
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">total commands</div>
                <div class="text-sm text-[#1a1a1a] font-mono">{formatNumber(serverInfo.total_commands_processed)}</div>
              </div>
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">total connections</div>
                <div class="text-sm text-[#1a1a1a] font-mono">{formatNumber(serverInfo.total_connections_received)}</div>
              </div>
              <div class="bg-[#fafafa] border border-[#d4d4d4] rounded p-3">
                <div class="text-xs text-[#9a9a9a]">hit rate</div>
                <div class="text-sm text-[#28c840] font-mono">{getHitRate()}%</div>
              </div>
            </div>
          </div>

          <!-- Keyspace -->
          <div>
            <h3 class="text-xs text-[#6b6b6b] mb-3">keyspace</h3>
            <div class="bg-[#fafafa] border border-[#d4d4d4] rounded overflow-hidden">
              <table class="w-full text-xs font-mono">
                <thead>
                  <tr class="border-b border-[#d4d4d4] bg-[#f0f0f0]">
                    <th class="text-left px-3 py-2 text-[#6b6b6b]">database</th>
                    <th class="text-right px-3 py-2 text-[#6b6b6b]">keys</th>
                    <th class="text-right px-3 py-2 text-[#6b6b6b]">expires</th>
                    <th class="text-right px-3 py-2 text-[#6b6b6b]">avg ttl</th>
                  </tr>
                </thead>
                <tbody>
                  {#each Object.entries(dbStats) as [db, stats]}
                    <tr class="border-b border-[#e5e5e5]">
                      <td class="px-3 py-2 text-[#1a1a1a]">{db}</td>
                      <td class="px-3 py-2 text-[#1a1a1a] text-right">{stats.keys}</td>
                      <td class="px-3 py-2 text-[#6b6b6b] text-right">{stats.expires}</td>
                      <td class="px-3 py-2 text-[#6b6b6b] text-right">{stats.avg_ttl}ms</td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="4" class="px-3 py-4 text-center text-[#9a9a9a]">no data</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else if !error}
          <div class="text-center py-8 text-xs text-[#9a9a9a]">loading...</div>
        {/if}
      </div>
    </div>
  </div>
{/if}
