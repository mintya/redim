<script lang="ts">
  import {
    RotateCw,
    X,
    ChevronDown,
    ChevronRight,
    Zap,
    Target,
    MemoryStick,
    Users,
    Ban,
    AlertTriangle,
    Save,
    GitBranch,
    Cpu,
    Clock,
    Database,
    Server,
    Activity,
  } from '@lucide/svelte';
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';
  import { portal } from '$lib/utils/portal';
  import { formatBytes as formatBytesUtil } from '$lib/utils/format';

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
    maxMemoryBytes: number;
    peakMemoryBytes: number;
    fragmentationRatio: number;
    connectedClients: number;
    blockedClients: number;
    hitRate: number;
    totalCommands: number;
    totalConnections: number;
    evictedKeys: number;
    rejectedConnections: number;
    expiredKeys: number;
    pubsubChannels: number;
    dbStats: Record<string, DbStats>;
  }

  let { open = $bindable(), onclose }: Props = $props();

  const refreshOptions = [1, 5, 10, 30];

  let rawInfo = $state('');
  let serverInfo = $state<Record<string, string> | null>(null);
  let snapshot = $state<MonitorSnapshot | null>(null);
  let previousSnapshot = $state<MonitorSnapshot | null>(null);
  let error = $state('');
  let loading = $state(false);
  let showRawInfo = $state(false);
  let showAdvanced = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let refreshIntervalSeconds = $state(5);
  let sampledConnectionId = $state<string | null>(null);

  function parseInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of info.split('\n')) {
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
      let keys = 0, expires = 0, avgTtlMs = 0;
      for (const part of info.split(',')) {
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

  function floatValue(infoMap: Record<string, string>, key: string): number {
    const v = parseFloat(infoMap[key] || '0');
    return Number.isFinite(v) ? v : 0;
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
      maxMemoryBytes: numberValue(infoMap, 'maxmemory'),
      peakMemoryBytes: numberValue(infoMap, 'used_memory_peak'),
      fragmentationRatio: floatValue(infoMap, 'mem_fragmentation_ratio'),
      connectedClients: numberValue(infoMap, 'connected_clients'),
      blockedClients: numberValue(infoMap, 'blocked_clients'),
      hitRate: calculateHitRate(infoMap),
      totalCommands: numberValue(infoMap, 'total_commands_processed'),
      totalConnections: numberValue(infoMap, 'total_connections_received'),
      evictedKeys: numberValue(infoMap, 'evicted_keys'),
      rejectedConnections: numberValue(infoMap, 'rejected_connections'),
      expiredKeys: numberValue(infoMap, 'expired_keys'),
      pubsubChannels: numberValue(infoMap, 'pubsub_channels'),
      dbStats: parseDbStats(infoMap),
    };
  }

  async function loadInfo() {
    if (!$activeConnectionId) return;
    const connectionChanged = sampledConnectionId !== $activeConnectionId;
    if (connectionChanged) {
      sampledConnectionId = $activeConnectionId;
      previousSnapshot = null;
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
      const next = buildSnapshot(parsed);
      previousSnapshot = connectionChanged ? null : snapshot;
      snapshot = next;
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
    return formatBytesUtil(bytes);
  }

  function formatDurationFromMs(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(s >= 10 ? 0 : 1)}s`;
    const m = s / 60;
    if (m < 60) return `${m.toFixed(m >= 10 ? 0 : 1)}m`;
    const h = m / 60;
    return `${h.toFixed(h >= 10 ? 0 : 1)}h`;
  }

  function formatUptime(days: number, seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    if (days >= 1) {
      const d = Math.floor(days);
      const remHours = Math.floor((seconds - d * 86400) / 3600);
      return remHours > 0 ? `${d}d ${remHours}h` : `${d}d`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatRelativeAge(secondsAgo: number): string {
    if (!Number.isFinite(secondsAgo) || secondsAgo < 0) return '—';
    if (secondsAgo < 60) return `${Math.round(secondsAgo)}s ago`;
    if (secondsAgo < 3600) return `${Math.round(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.round(secondsAgo / 3600)}h ago`;
    return `${Math.round(secondsAgo / 86400)}d ago`;
  }

  function getDelta(current?: number, previous?: number): number | null {
    if (current === undefined || previous === undefined) return null;
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    return current - previous;
  }

  function deltaToneClass(delta: number | null, epsilon = 0.0001): string {
    if (delta === null || Math.abs(delta) <= epsilon) return 'text-[var(--color-text-muted)]';
    return delta > 0 ? 'text-[var(--color-type-string)]' : 'text-[var(--color-accent)]';
  }

  function formatDelta(delta: number | null, fractionDigits = 0, unit = ''): string {
    if (delta === null || Math.abs(delta) < 0.0001) return '';
    const sign = delta > 0 ? '+' : '−';
    return `${sign}${Math.abs(delta).toFixed(fractionDigits)}${unit}`;
  }

  function formatBytesDelta(delta: number | null): string {
    if (delta === null || Math.abs(delta) < 1) return '';
    const sign = delta > 0 ? '+' : '−';
    return `${sign}${formatBytes(Math.abs(delta))}`;
  }

  function dbSortIndex(db: string): number {
    const p = Number(db.replace('db', ''));
    return Number.isFinite(p) ? p : 0;
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

  let opsDelta = $derived(getDelta(snapshot?.opsPerSec, previousSnapshot?.opsPerSec));
  let hitDelta = $derived(getDelta(snapshot?.hitRate, previousSnapshot?.hitRate));
  let memoryDelta = $derived(getDelta(snapshot?.usedMemoryBytes, previousSnapshot?.usedMemoryBytes));
  let clientsDelta = $derived(getDelta(snapshot?.connectedClients, previousSnapshot?.connectedClients));
  let evictedDelta = $derived(getDelta(snapshot?.evictedKeys, previousSnapshot?.evictedKeys));
  let rejectedDelta = $derived(getDelta(snapshot?.rejectedConnections, previousSnapshot?.rejectedConnections));

  let dbEntries = $derived.by(() => {
    if (!snapshot) return [] as Array<[string, DbStats]>;
    return Object.entries(snapshot.dbStats).sort((a, b) => dbSortIndex(a[0]) - dbSortIndex(b[0]));
  });

  let memoryUsagePercent = $derived.by(() => {
    if (!snapshot || snapshot.maxMemoryBytes <= 0) return null;
    return (snapshot.usedMemoryBytes / snapshot.maxMemoryBytes) * 100;
  });

  let rdbLastSaveAge = $derived.by(() => {
    if (!serverInfo?.rdb_last_save_time) return null;
    const ts = Number(serverInfo.rdb_last_save_time);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    return Date.now() / 1000 - ts;
  });

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
    use:portal
    class="fixed inset-0 flex items-center justify-center z-50 glass-backdrop"
    onclick={(e) => e.target === e.currentTarget && handleClose()}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="ui-modal w-full max-w-3xl max-h-[86vh] flex flex-col">
      <div class="ui-panel-header ui-monitor-header">
        <span class="ui-section-label">Server Info</span>
        <div class="ui-monitor-actions">
          <div class="ui-segment ui-monitor-segment">
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
          <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={() => (showRawInfo = !showRawInfo)}>
            {showRawInfo ? 'Hide Raw' : 'Show Raw'}
          </button>
          <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={loadInfo} disabled={loading}>
            <RotateCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
            Refresh
          </button>
          <button class="ui-btn ui-btn-ghost ui-btn-icon" onclick={handleClose}>
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#if error}
          <div class="px-3 py-2 text-xs rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
            {error}
          </div>
        {/if}

        {#if serverInfo && snapshot}
          <!-- Server identity strip -->
          <div class="info-strip">
            <Server class="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0" />
            <div class="info-strip-item">
              <span class="info-strip-label">version</span>
              <span class="info-strip-value">{serverInfo.redis_version || '—'}</span>
            </div>
            <div class="info-strip-divider"></div>
            <div class="info-strip-item">
              <span class="info-strip-label">mode</span>
              <span class="info-strip-value">{serverInfo.redis_mode || 'standalone'}</span>
            </div>
            <div class="info-strip-divider"></div>
            <div class="info-strip-item">
              <span class="info-strip-label">role</span>
              <span class="info-strip-value">{serverInfo.role || '—'}</span>
            </div>
            <div class="info-strip-divider"></div>
            <div class="info-strip-item">
              <span class="info-strip-label">os</span>
              <span class="info-strip-value">{serverInfo.os || '—'}</span>
            </div>
            <div class="info-strip-divider"></div>
            <div class="info-strip-item">
              <span class="info-strip-label">uptime</span>
              <span class="info-strip-value">
                {formatUptime(Number(serverInfo.uptime_in_days || 0), Number(serverInfo.uptime_in_seconds || 0))}
              </span>
            </div>
          </div>

          <!-- Live metrics grid -->
          <div>
            <div class="ui-subtle mb-1.5 px-0.5">Live</div>
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <div class="stat-card">
                <div class="stat-card-head">
                  <Zap class="w-3 h-3 text-[var(--color-chart-ops)]" />
                  <span class="stat-card-label">ops/sec</span>
                  {#key snapshot.opsPerSec}
                    {#if opsDelta !== null && Math.abs(opsDelta) > 0.0001}
                      <span class="stat-delta delta-fade {deltaToneClass(opsDelta)}">{formatDelta(opsDelta, 0)}</span>
                    {/if}
                  {/key}
                </div>
                {#key snapshot.opsPerSec}
                  <div class="stat-value value-flash">{formatNumber(snapshot.opsPerSec)}</div>
                {/key}
              </div>

              <div class="stat-card">
                <div class="stat-card-head">
                  <Target class="w-3 h-3 text-[var(--color-chart-hit)]" />
                  <span class="stat-card-label">hit rate</span>
                  {#key snapshot.hitRate.toFixed(2)}
                    {#if hitDelta !== null && Math.abs(hitDelta) > 0.01}
                      <span class="stat-delta delta-fade {deltaToneClass(hitDelta, 0.01)}">{formatDelta(hitDelta, 1, '%')}</span>
                    {/if}
                  {/key}
                </div>
                {#key snapshot.hitRate.toFixed(2)}
                  <div class="stat-value value-flash">{snapshot.hitRate.toFixed(1)}<span class="stat-unit">%</span></div>
                {/key}
              </div>

              <div class="stat-card">
                <div class="stat-card-head">
                  <MemoryStick class="w-3 h-3 text-[var(--color-chart-memory)]" />
                  <span class="stat-card-label">memory</span>
                  {#key snapshot.usedMemoryBytes}
                    {#if memoryDelta !== null && Math.abs(memoryDelta) > 1024}
                      <span class="stat-delta delta-fade {deltaToneClass(memoryDelta, 1024)}">{formatBytesDelta(memoryDelta)}</span>
                    {/if}
                  {/key}
                </div>
                {#key snapshot.usedMemoryBytes}
                  <div class="stat-value value-flash">{formatBytes(snapshot.usedMemoryBytes)}</div>
                {/key}
                {#if memoryUsagePercent !== null}
                  <div class="stat-sub">
                    {memoryUsagePercent.toFixed(1)}% of {formatBytes(snapshot.maxMemoryBytes)}
                  </div>
                {:else}
                  <div class="stat-sub">peak {formatBytes(snapshot.peakMemoryBytes)}</div>
                {/if}
              </div>

              <div class="stat-card">
                <div class="stat-card-head">
                  <Users class="w-3 h-3 text-[var(--color-chart-clients)]" />
                  <span class="stat-card-label">clients</span>
                  {#key snapshot.connectedClients}
                    {#if clientsDelta !== null && Math.abs(clientsDelta) > 0}
                      <span class="stat-delta delta-fade {deltaToneClass(clientsDelta)}">{formatDelta(clientsDelta, 0)}</span>
                    {/if}
                  {/key}
                </div>
                {#key snapshot.connectedClients}
                  <div class="stat-value value-flash">{formatNumber(snapshot.connectedClients)}</div>
                {/key}
                {#if snapshot.blockedClients > 0}
                  <div class="stat-sub text-[var(--color-type-hash)]">{snapshot.blockedClients} blocked</div>
                {/if}
              </div>

              <div class="stat-card">
                <div class="stat-card-head">
                  <Ban class="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  <span class="stat-card-label">evicted</span>
                  {#key snapshot.evictedKeys}
                    {#if evictedDelta !== null && evictedDelta > 0}
                      <span class="stat-delta delta-fade text-[var(--color-accent)]">{formatDelta(evictedDelta, 0)}</span>
                    {/if}
                  {/key}
                </div>
                {#key snapshot.evictedKeys}
                  <div class="stat-value value-flash {snapshot.evictedKeys > 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}">{formatNumber(snapshot.evictedKeys)}</div>
                {/key}
              </div>

              <div class="stat-card">
                <div class="stat-card-head">
                  <AlertTriangle class="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  <span class="stat-card-label">rejected</span>
                  {#key snapshot.rejectedConnections}
                    {#if rejectedDelta !== null && rejectedDelta > 0}
                      <span class="stat-delta delta-fade text-[var(--color-accent)]">{formatDelta(rejectedDelta, 0)}</span>
                    {/if}
                  {/key}
                </div>
                {#key snapshot.rejectedConnections}
                  <div class="stat-value value-flash {snapshot.rejectedConnections > 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}">{formatNumber(snapshot.rejectedConnections)}</div>
                {/key}
              </div>
            </div>
          </div>

          <!-- Keyspace -->
          <div>
            <div class="ui-subtle mb-1.5 px-0.5 flex items-center gap-1.5">
              <Database class="w-3 h-3 text-[var(--color-text-tertiary)]" />
              <span>Keyspace</span>
            </div>
            {#if dbEntries.length === 0}
              <div class="text-xs text-[var(--color-text-muted)] px-1 py-2">No populated databases</div>
            {:else}
              <div class="db-list">
                {#each dbEntries as [db, stats]}
                  <div class="db-row">
                    <span class="db-name">{db}</span>
                    <span class="db-stat">
                      <span class="db-num">{formatNumber(stats.keys)}</span>
                      <span class="db-stat-label">keys</span>
                    </span>
                    <span class="db-stat">
                      <span class="db-num">{formatNumber(stats.expires)}</span>
                      <span class="db-stat-label">expires</span>
                      {#if stats.keys > 0 && stats.expires > 0}
                        <span class="db-ratio">({((stats.expires / stats.keys) * 100).toFixed(1)}%)</span>
                      {/if}
                    </span>
                    <span class="db-stat">
                      <span class="db-stat-label">avg TTL</span>
                      <span class="db-num">{formatDurationFromMs(stats.avgTtlMs)}</span>
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Persistence & cumulative -->
          <div>
            <div class="ui-subtle mb-1.5 px-0.5 flex items-center gap-1.5">
              <Save class="w-3 h-3 text-[var(--color-text-tertiary)]" />
              <span>Persistence</span>
            </div>
            <div class="info-strip flex-wrap">
              <div class="info-strip-item">
                <span class="info-strip-label">RDB</span>
                <span class="info-strip-value">
                  {rdbLastSaveAge !== null ? `saved ${formatRelativeAge(rdbLastSaveAge)}` : '—'}
                </span>
              </div>
              <div class="info-strip-divider"></div>
              <div class="info-strip-item">
                <span class="info-strip-label">AOF</span>
                <span class="info-strip-value">{serverInfo.aof_enabled === '1' ? 'enabled' : 'disabled'}</span>
              </div>
              <div class="info-strip-divider"></div>
              <div class="info-strip-item">
                <span class="info-strip-label">fragmentation</span>
                <span class="info-strip-value">{snapshot.fragmentationRatio > 0 ? snapshot.fragmentationRatio.toFixed(2) : '—'}</span>
              </div>
              {#if Number(serverInfo.connected_slaves || 0) > 0}
                <div class="info-strip-divider"></div>
                <div class="info-strip-item">
                  <GitBranch class="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  <span class="info-strip-value">{serverInfo.connected_slaves} replicas</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Cumulative counters -->
          <div>
            <div class="ui-subtle mb-1.5 px-0.5 flex items-center gap-1.5">
              <Activity class="w-3 h-3 text-[var(--color-text-tertiary)]" />
              <span>Cumulative</span>
            </div>
            <div class="info-strip flex-wrap">
              <div class="info-strip-item">
                <span class="info-strip-label">commands</span>
                <span class="info-strip-value">{formatNumber(snapshot.totalCommands)}</span>
              </div>
              <div class="info-strip-divider"></div>
              <div class="info-strip-item">
                <span class="info-strip-label">connections</span>
                <span class="info-strip-value">{formatNumber(snapshot.totalConnections)}</span>
              </div>
              <div class="info-strip-divider"></div>
              <div class="info-strip-item">
                <span class="info-strip-label">expired</span>
                <span class="info-strip-value">{formatNumber(snapshot.expiredKeys)}</span>
              </div>
              {#if snapshot.pubsubChannels > 0}
                <div class="info-strip-divider"></div>
                <div class="info-strip-item">
                  <span class="info-strip-label">pubsub channels</span>
                  <span class="info-strip-value">{formatNumber(snapshot.pubsubChannels)}</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Advanced (collapsible) -->
          <div>
            <button
              class="ui-btn ui-btn-ghost ui-btn-sm px-1"
              onclick={() => (showAdvanced = !showAdvanced)}
            >
              {#if showAdvanced}
                <ChevronDown class="w-3.5 h-3.5" />
              {:else}
                <ChevronRight class="w-3.5 h-3.5" />
              {/if}
              <span>Advanced</span>
            </button>
            {#if showAdvanced}
              <div class="info-strip flex-wrap mt-1.5">
                <div class="info-strip-item">
                  <Cpu class="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  <span class="info-strip-label">cpu sys</span>
                  <span class="info-strip-value">{Number(serverInfo.used_cpu_sys || 0).toFixed(2)}s</span>
                </div>
                <div class="info-strip-divider"></div>
                <div class="info-strip-item">
                  <span class="info-strip-label">cpu user</span>
                  <span class="info-strip-value">{Number(serverInfo.used_cpu_user || 0).toFixed(2)}s</span>
                </div>
                <div class="info-strip-divider"></div>
                <div class="info-strip-item">
                  <Clock class="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  <span class="info-strip-label">latest fork</span>
                  <span class="info-strip-value">{Number(serverInfo.latest_fork_usec || 0) > 0 ? `${Math.round(Number(serverInfo.latest_fork_usec) / 1000)}ms` : '—'}</span>
                </div>
                <div class="info-strip-divider"></div>
                <div class="info-strip-item">
                  <span class="info-strip-label">peak memory</span>
                  <span class="info-strip-value">{formatBytes(snapshot.peakMemoryBytes)}</span>
                </div>
                {#if serverInfo.maxmemory_policy}
                  <div class="info-strip-divider"></div>
                  <div class="info-strip-item">
                    <span class="info-strip-label">eviction policy</span>
                    <span class="info-strip-value">{serverInfo.maxmemory_policy}</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {:else if !error}
          <div class="text-center py-10 text-xs text-[var(--color-text-muted)]">
            {loading ? 'Loading…' : 'Collecting server info…'}
          </div>
        {/if}

        {#if showRawInfo && rawInfo}
          <div class="ui-panel">
            <div class="ui-panel-header">
              <span class="ui-subtle">Raw INFO output</span>
            </div>
            <div class="ui-panel-body">
              <pre class="bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] p-3 rounded-md text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">{rawInfo}</pre>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .info-strip {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.45);
    border: 0.5px solid var(--color-glass-border-subtle, rgba(0, 0, 0, 0.05));
    font-size: 11px;
    line-height: 1.2;
  }

  .info-strip-item {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    min-width: 0;
  }

  .info-strip-label {
    color: var(--color-text-tertiary);
    font-size: 10px;
    letter-spacing: 0.02em;
  }

  .info-strip-value {
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  .info-strip-divider {
    width: 1px;
    height: 10px;
    background: var(--color-divider-soft);
    flex-shrink: 0;
  }

  .stat-card {
    position: relative;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.45);
    border: 0.5px solid var(--color-glass-border-subtle, rgba(0, 0, 0, 0.05));
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .stat-card-head {
    display: flex;
    align-items: center;
    gap: 0.3125rem;
    color: var(--color-text-tertiary);
    font-size: 10px;
    letter-spacing: 0.02em;
    min-height: 14px;
  }

  .stat-card-label {
    color: var(--color-text-tertiary);
    flex: 1;
    min-width: 0;
  }

  .stat-value {
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    border-radius: 4px;
    margin: 0 -2px;
    padding: 0 2px;
  }

  .stat-unit {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-left: 1px;
  }

  .stat-sub {
    font-size: 10px;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    margin-top: 0.0625rem;
  }

  .stat-delta {
    font-size: 10px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
    flex-shrink: 0;
  }

  .value-flash {
    animation: value-flash 0.55s ease-out;
  }

  @keyframes value-flash {
    0% { background: rgba(207, 63, 50, 0.10); }
    60% { background: rgba(207, 63, 50, 0.04); }
    100% { background: transparent; }
  }

  .delta-fade {
    animation: delta-life 1.8s ease-out forwards;
    will-change: opacity, transform;
  }

  @keyframes delta-life {
    0% { opacity: 0; transform: translateY(-3px); }
    15% { opacity: 1; transform: translateY(0); }
    72% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(2px); }
  }

  .db-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .db-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4375rem 0.75rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.45);
    border: 0.5px solid var(--color-glass-border-subtle, rgba(0, 0, 0, 0.05));
    font-size: 11px;
    line-height: 1.2;
    flex-wrap: wrap;
  }

  .db-name {
    font-weight: 600;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    min-width: 2.25rem;
  }

  .db-stat {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    color: var(--color-text-tertiary);
  }

  .db-num {
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  .db-stat-label {
    color: var(--color-text-tertiary);
    font-size: 10px;
  }

  .db-ratio {
    color: var(--color-text-muted);
    font-size: 10px;
    margin-left: 0.125rem;
  }
</style>
