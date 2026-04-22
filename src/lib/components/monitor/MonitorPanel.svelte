<script lang="ts">
  import { RotateCw, X, ChevronDown, ChevronRight } from '@lucide/svelte';
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';
  import SparklineChart from '$lib/components/common/SparklineChart.svelte';
  import MiniBarChart from '$lib/components/common/MiniBarChart.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  interface DbStats {
    keys: number;
    expires: number;
    avgTtlMs: number;
  }

  interface MonitorSnapshot {
    ts: number;
    opsPerSec: number;
    usedMemoryBytes: number;
    connectedClients: number;
    hitRate: number;
    totalCommands: number;
    totalConnections: number;
    dbStats: Record<string, DbStats>;
  }

  let { open = $bindable(), onclose }: Props = $props();

  const refreshOptions = [1, 5, 10, 30];
  const windowOptions = [1, 5, 15];
  const HISTORY_RETENTION_MINUTES = 15;

  let rawInfo = $state('');
  let serverInfo = $state<Record<string, string> | null>(null);
  let error = $state('');
  let loading = $state(false);
  let showRawInfo = $state(false);
  let showPerformance = $state(true);
  let showKeyspace = $state(true);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let refreshIntervalSeconds = $state(5);
  let chartWindowMinutes = $state(5);
  let history = $state<MonitorSnapshot[]>([]);
  let sampledConnectionId = $state<string | null>(null);

  function parseInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\n');
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

  function parseDbStats(infoMap: Record<string, string>): Record<string, DbStats> {
    const result: Record<string, DbStats> = {};
    for (const [db, info] of Object.entries(infoMap)) {
      if (!/^db\d+$/.test(db)) continue;
      const parts = info.split(',');
      let keys = 0;
      let expires = 0;
      let avgTtlMs = 0;
      for (const part of parts) {
        const [k, v] = part.split('=');
        if (k === 'keys') keys = Number(v || 0);
        if (k === 'expires') expires = Number(v || 0);
        if (k === 'avg_ttl') avgTtlMs = Number(v || 0);
      }
      result[db] = { keys, expires, avgTtlMs };
    }
    return result;
  }

  function numberValue(infoMap: Record<string, string>, key: string): number {
    return Number(infoMap[key] || 0);
  }

  function calculateHitRate(infoMap: Record<string, string>): number {
    const hits = numberValue(infoMap, 'keyspace_hits');
    const misses = numberValue(infoMap, 'keyspace_misses');
    const total = hits + misses;
    if (total === 0) return 0;
    return (hits / total) * 100;
  }

  function buildSnapshot(infoMap: Record<string, string>): MonitorSnapshot {
    return {
      ts: Date.now(),
      opsPerSec: numberValue(infoMap, 'instantaneous_ops_per_sec'),
      usedMemoryBytes: numberValue(infoMap, 'used_memory'),
      connectedClients: numberValue(infoMap, 'connected_clients'),
      hitRate: calculateHitRate(infoMap),
      totalCommands: numberValue(infoMap, 'total_commands_processed'),
      totalConnections: numberValue(infoMap, 'total_connections_received'),
      dbStats: parseDbStats(infoMap),
    };
  }

  function appendSnapshot(snapshot: MonitorSnapshot) {
    const cutoff = snapshot.ts - HISTORY_RETENTION_MINUTES * 60 * 1000;
    history = [...history.filter((item) => item.ts >= cutoff), snapshot];
  }

  async function loadInfo() {
    if (!$activeConnectionId) return;
    if (sampledConnectionId !== $activeConnectionId) {
      sampledConnectionId = $activeConnectionId;
      history = [];
    }

    loading = true;
    error = '';
    try {
      const result = await invoke<string>('execute_command', {
        id: $activeConnectionId,
        args: ['INFO'],
      });
      rawInfo = result;
      const parsed = parseInfo(result);
      serverInfo = parsed;
      appendSnapshot(buildSnapshot(parsed));
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function formatNumber(num: number | string): string {
    return Number(num || 0).toLocaleString();
  }

  function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
  }

  function formatDurationFromMs(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(minutes >= 10 ? 0 : 1)}m`;
    const hours = minutes / 60;
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }

  function formatUptimeDaysToReadable(days: number): string {
    if (!Number.isFinite(days) || days < 0) return '0d';
    if (days < 1) return '<1d';
    return `${Math.round(days)}d`;
  }

  function getDelta(current: number | undefined, previous: number | undefined): number | null {
    if (!Number.isFinite(current ?? NaN) || !Number.isFinite(previous ?? NaN)) return null;
    return (current ?? 0) - (previous ?? 0);
  }

  function deltaSymbol(delta: number | null, epsilon = 0.0001): string {
    if (delta === null) return '•';
    if (Math.abs(delta) <= epsilon) return '•';
    return delta > 0 ? '▲' : '▼';
  }

  function deltaToneClass(delta: number | null, epsilon = 0.0001): string {
    if (delta === null) return 'text-[var(--color-text-muted)]';
    if (Math.abs(delta) <= epsilon) return 'text-[var(--color-text-muted)]';
    return delta > 0 ? 'text-[var(--color-type-string)]' : 'text-[var(--color-accent)]';
  }

  function formatAbsDelta(delta: number | null, fractionDigits = 1, unit = ''): string {
    if (delta === null) return '—';
    if (Math.abs(delta) <= 0.0001) return `0${unit}`;
    return `${Math.abs(delta).toFixed(fractionDigits)}${unit}`;
  }

  function formatAbsBytesDelta(delta: number | null): string {
    if (delta === null) return '—';
    if (Math.abs(delta) < 1) return '0 B';
    return formatBytes(Math.abs(delta));
  }

  function dbSortIndex(db: string): number {
    const parsed = Number(db.replace('db', ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    if (refreshIntervalSeconds > 0) {
      void loadInfo();
      refreshInterval = setInterval(() => void loadInfo(), refreshIntervalSeconds * 1000);
    }
  }

  function handleClose() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    onclose();
  }

  let filteredHistory = $derived.by(() => {
    const cutoff = Date.now() - chartWindowMinutes * 60 * 1000;
    return history.filter((item) => item.ts >= cutoff);
  });

  let latestSnapshot = $derived(
    filteredHistory.length > 0 ? filteredHistory[filteredHistory.length - 1] : null
  );
  let previousSnapshot = $derived(
    filteredHistory.length > 1 ? filteredHistory[filteredHistory.length - 2] : null
  );
  let opsDelta = $derived(getDelta(latestSnapshot?.opsPerSec, previousSnapshot?.opsPerSec));
  let hitDelta = $derived(getDelta(latestSnapshot?.hitRate, previousSnapshot?.hitRate));
  let memoryDelta = $derived(getDelta(latestSnapshot?.usedMemoryBytes, previousSnapshot?.usedMemoryBytes));
  let clientsDelta = $derived(
    getDelta(latestSnapshot?.connectedClients, previousSnapshot?.connectedClients)
  );

  let opsSeries = $derived(filteredHistory.map((item) => ({ ts: item.ts, value: item.opsPerSec })));
  let hitRateSeries = $derived(filteredHistory.map((item) => ({ ts: item.ts, value: item.hitRate })));
  let memorySeries = $derived(filteredHistory.map((item) => ({ ts: item.ts, value: item.usedMemoryBytes })));
  let clientSeries = $derived(filteredHistory.map((item) => ({ ts: item.ts, value: item.connectedClients })));

  let dbEntries = $derived.by(() => {
    if (!latestSnapshot) return [] as Array<[string, DbStats]>;
    return Object.entries(latestSnapshot.dbStats).sort((a, b) => dbSortIndex(a[0]) - dbSortIndex(b[0]));
  });

  let topDbByKeys = $derived.by(() => {
    return [...dbEntries]
      .filter(([, stats]) => stats.keys > 0)
      .sort((a, b) => b[1].keys - a[1].keys)
      .slice(0, 10);
  });

  let dbKeyItems = $derived.by(() =>
    topDbByKeys.map(([db, stats]) => ({
      label: db,
      value: stats.keys,
      displayValue: formatNumber(stats.keys),
    }))
  );

  let dbExpiresRatioItems = $derived.by(() =>
    topDbByKeys.map(([db, stats]) => {
      const ratio = stats.keys > 0 ? (stats.expires / stats.keys) * 100 : 0;
      return {
        label: db,
        value: ratio,
        displayValue: `${ratio.toFixed(1)}%`,
      };
    })
  );

  let dbTtlItems = $derived.by(() =>
    topDbByKeys.map(([db, stats]) => ({
      label: db,
      value: stats.avgTtlMs,
      displayValue: formatDurationFromMs(stats.avgTtlMs),
    }))
  );

  $effect(() => {
    if (open && $activeConnectionId) {
      void loadInfo();
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
    class="fixed inset-0 bg-[var(--color-text-primary)]/5 backdrop-blur-[1px] flex items-center justify-center z-50"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="ui-panel w-full max-w-5xl max-h-[86vh] flex flex-col shadow-[var(--shadow-md)]">
      <div class="ui-panel-header">
        <span class="ui-section-label">server info</span>
        <div class="flex items-center gap-2">
          <div class="ui-segment">
            {#each refreshOptions as secs}
              <button
                class="ui-segment-item {refreshIntervalSeconds === secs ? 'ui-segment-item-active' : ''}"
                onclick={() => {
                  refreshIntervalSeconds = secs;
                  startAutoRefresh();
                }}
              >
                {secs}s
              </button>
            {/each}
          </div>
          <div class="ui-segment">
            {#each windowOptions as mins}
              <button
                class="ui-segment-item {chartWindowMinutes === mins ? 'ui-segment-item-active' : ''}"
                onclick={() => {
                  chartWindowMinutes = mins;
                }}
              >
                {mins}m
              </button>
            {/each}
          </div>
          <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={() => (showRawInfo = !showRawInfo)}>
            {showRawInfo ? 'hide raw' : 'show raw'}
          </button>
          <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={loadInfo}>
            <RotateCw class="w-3.5 h-3.5" />
            refresh
          </button>
          <button class="ui-btn ui-btn-ghost ui-btn-icon" onclick={handleClose}>
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 bg-[var(--color-bg-surface)]">
        {#if error}
          <div class="mb-3 px-3 py-2 text-xs rounded-[6px] border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
            {error}
          </div>
        {/if}

        {#if serverInfo && latestSnapshot}
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <div class="ui-panel">
              <div class="ui-panel-body">
                <div class="ui-subtle mb-1">version</div>
                <div class="text-xs text-[var(--color-text-primary)] font-sans">{serverInfo.redis_version || '-'}</div>
              </div>
            </div>
            <div class="ui-panel">
              <div class="ui-panel-body">
                <div class="ui-subtle mb-1">uptime</div>
                <div class="text-xs text-[var(--color-text-primary)] font-sans">
                  {formatUptimeDaysToReadable(Number(serverInfo.uptime_in_days || 0))}
                </div>
              </div>
            </div>
            <div class="ui-panel">
              <div class="ui-panel-body">
                <div class="ui-subtle mb-1">total commands</div>
                <div class="text-xs text-[var(--color-text-primary)] font-sans">
                  {formatNumber(latestSnapshot.totalCommands)}
                </div>
              </div>
            </div>
            <div class="ui-panel">
              <div class="ui-panel-body">
                <div class="ui-subtle mb-1">total connections</div>
                <div class="text-xs text-[var(--color-text-primary)] font-sans">
                  {formatNumber(latestSnapshot.totalConnections)}
                </div>
              </div>
            </div>
          </div>

          <div class="ui-panel mb-3">
            <div class="ui-panel-header">
              <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={() => (showPerformance = !showPerformance)}>
                {#if showPerformance}
                  <ChevronDown class="w-3.5 h-3.5" />
                {:else}
                  <ChevronRight class="w-3.5 h-3.5" />
                {/if}
                <span>performance</span>
              </button>
            </div>
            {#if showPerformance}
              <div class="ui-panel-body space-y-3">
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-[6px] px-3 py-2">
                    <div class="ui-subtle mb-1">ops/sec</div>
                    <div class="text-xs text-[var(--color-text-primary)] font-sans">{formatNumber(latestSnapshot.opsPerSec)}</div>
                    <div class={`text-[10px] ${deltaToneClass(opsDelta)}`}>
                      {deltaSymbol(opsDelta)} {formatAbsDelta(opsDelta, 0)}
                    </div>
                  </div>
                  <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-[6px] px-3 py-2">
                    <div class="ui-subtle mb-1">hit rate</div>
                    <div class="text-xs text-[var(--color-text-primary)] font-sans">{latestSnapshot.hitRate.toFixed(1)}%</div>
                    <div class={`text-[10px] ${deltaToneClass(hitDelta)}`}>
                      {deltaSymbol(hitDelta)} {formatAbsDelta(hitDelta, 1, '%')}
                    </div>
                  </div>
                  <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-[6px] px-3 py-2">
                    <div class="ui-subtle mb-1">memory</div>
                    <div class="text-xs text-[var(--color-text-primary)] font-sans">{formatBytes(latestSnapshot.usedMemoryBytes)}</div>
                    <div class={`text-[10px] ${deltaToneClass(memoryDelta, 1)}`}>
                      {deltaSymbol(memoryDelta, 1)} {formatAbsBytesDelta(memoryDelta)}
                    </div>
                  </div>
                  <div class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-[6px] px-3 py-2">
                    <div class="ui-subtle mb-1">clients</div>
                    <div class="text-xs text-[var(--color-text-primary)] font-sans">{formatNumber(latestSnapshot.connectedClients)}</div>
                    <div class={`text-[10px] ${deltaToneClass(clientsDelta)}`}>
                      {deltaSymbol(clientsDelta)} {formatAbsDelta(clientsDelta, 0)}
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] p-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="ui-subtle">ops/sec trend</span>
                      <span class="text-[10px] text-[var(--color-text-secondary)]">{formatNumber(latestSnapshot.opsPerSec)}</span>
                    </div>
                    <SparklineChart
                      series={opsSeries}
                      stroke="var(--color-chart-ops)"
                      strokeWidth={1.1}
                      strokeOpacity={0.76}
                      areaOpacity={0.05}
                      pointRadius={1.35}
                    />
                  </div>
                  <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] p-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="ui-subtle">hit rate trend</span>
                      <span class="text-[10px] text-[var(--color-text-secondary)]">{latestSnapshot.hitRate.toFixed(1)}%</span>
                    </div>
                    <SparklineChart
                      series={hitRateSeries}
                      stroke="var(--color-chart-hit)"
                      strokeWidth={1.1}
                      strokeOpacity={0.76}
                      areaOpacity={0.05}
                      pointRadius={1.35}
                    />
                  </div>
                  <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] p-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="ui-subtle">memory trend</span>
                      <span class="text-[10px] text-[var(--color-text-secondary)]">{formatBytes(latestSnapshot.usedMemoryBytes)}</span>
                    </div>
                    <SparklineChart
                      series={memorySeries}
                      stroke="var(--color-chart-memory)"
                      strokeWidth={1.1}
                      strokeOpacity={0.76}
                      areaOpacity={0.05}
                      pointRadius={1.35}
                    />
                  </div>
                  <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] p-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="ui-subtle">clients trend</span>
                      <span class="text-[10px] text-[var(--color-text-secondary)]">{formatNumber(latestSnapshot.connectedClients)}</span>
                    </div>
                    <SparklineChart
                      series={clientSeries}
                      stroke="var(--color-chart-clients)"
                      strokeWidth={1.1}
                      strokeOpacity={0.76}
                      areaOpacity={0.05}
                      pointRadius={1.35}
                    />
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <div class="ui-panel mb-3">
            <div class="ui-panel-header">
              <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={() => (showKeyspace = !showKeyspace)}>
                {#if showKeyspace}
                  <ChevronDown class="w-3.5 h-3.5" />
                {:else}
                  <ChevronRight class="w-3.5 h-3.5" />
                {/if}
                <span>keyspace</span>
              </button>
            </div>
            {#if showKeyspace}
              <div class="ui-panel-body space-y-3">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-2">
                  <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] p-2">
                    <div class="ui-subtle mb-1">db keys (top 10)</div>
                    <MiniBarChart items={dbKeyItems} barColor="var(--color-type-list)" />
                  </div>
                  <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] p-2">
                    <div class="ui-subtle mb-1">expires ratio</div>
                    <MiniBarChart items={dbExpiresRatioItems} barColor="var(--color-type-zset)" />
                  </div>
                  <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] p-2">
                    <div class="ui-subtle mb-1">avg ttl</div>
                    <MiniBarChart items={dbTtlItems} barColor="var(--color-type-hash)" />
                  </div>
                </div>

                <div class="overflow-hidden">
                  <table class="ui-data-table text-xs font-sans">
                    <thead>
                      <tr>
                        <th>database</th>
                        <th class="text-right">keys</th>
                        <th class="text-right">expires</th>
                        <th class="text-right">avg ttl</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each dbEntries as [db, stats]}
                        <tr>
                          <td>{db}</td>
                          <td class="text-right">{formatNumber(stats.keys)}</td>
                          <td class="text-right text-[var(--color-text-muted)]">{formatNumber(stats.expires)}</td>
                          <td class="text-right text-[var(--color-text-muted)]">{formatDurationFromMs(stats.avgTtlMs)}</td>
                        </tr>
                      {:else}
                        <tr>
                          <td colspan="4" class="text-center text-[var(--color-text-muted)]">no data</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/if}
          </div>
        {:else if !error}
          <div class="text-center py-10 text-xs text-[var(--color-text-muted)]">
            {loading ? 'loading...' : 'collecting server info...'}
          </div>
        {/if}

        {#if showRawInfo && rawInfo}
          <div class="ui-panel mt-3">
            <div class="ui-panel-header">
              <span class="ui-subtle">raw INFO output</span>
            </div>
            <div class="ui-panel-body">
              <pre class="bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] p-3 rounded-[6px] text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">{rawInfo}</pre>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
