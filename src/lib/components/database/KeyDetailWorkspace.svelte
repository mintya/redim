<script lang="ts">
  import { untrack } from 'svelte';
  import { keyTabs, activeTabId, activateTab, closeTab } from '$lib/stores/database';
  import KeyDetail from './KeyDetail.svelte';

  type TabBarMode = 'pager' | 'wrap';

  const TAB_SLOT_WIDTH = 196;

  let tabBarMode = $state<TabBarMode>('pager');
  let firstVisibleIndex = $state(0);
  let viewportWidth = $state(0);

  function attachResize(node: HTMLDivElement) {
    viewportWidth = node.clientWidth;
    const ro = new ResizeObserver(() => {
      viewportWidth = node.clientWidth;
    });
    ro.observe(node);
    return {
      destroy() {
        ro.disconnect();
      },
    };
  }

  let maxVisible = $derived.by(() => {
    if (viewportWidth < 48) return 1;
    return Math.max(1, Math.floor(viewportWidth / TAB_SLOT_WIDTH));
  });

  let maxStartIndex = $derived(Math.max(0, $keyTabs.length - maxVisible));

  let visibleTabsPager = $derived($keyTabs.slice(firstVisibleIndex, firstVisibleIndex + maxVisible));

  /**
   * 仅在激活标签、标签列表或可视数量变化时校正窗口，避免与手动翻动打架。
   * firstVisibleIndex 变化不再触发此逻辑。
   */
  $effect(() => {
    const aid = $activeTabId;
    const tabs = $keyTabs;
    const mv = maxVisible;

    untrack(() => {
      const ms = Math.max(0, tabs.length - mv);
      const idx = tabs.findIndex(t => t.id === aid);
      const cur = firstVisibleIndex;

      if (idx < 0) {
        if (cur > ms) firstVisibleIndex = ms;
        return;
      }

      let next = cur;
      if (idx < next) next = idx;
      if (idx >= next + mv) next = idx - mv + 1;
      next = Math.max(0, Math.min(ms, next));
      if (next !== cur) firstVisibleIndex = next;
    });
  });

  $effect(() => {
    const ms = maxStartIndex;
    untrack(() => {
      if (firstVisibleIndex > ms) firstVisibleIndex = ms;
    });
  });

  function shiftPager(delta: number) {
    const ms = maxStartIndex;
    firstVisibleIndex = Math.max(0, Math.min(ms, firstVisibleIndex + delta));
  }

  function tabTitle(key: string, max = 28) {
    if (key.length <= max) return key;
    return key.slice(0, max - 1) + '…';
  }
</script>

<div class="flex-1 flex flex-col bg-[var(--color-macos-surface)] overflow-hidden min-w-0">
  {#if $keyTabs.length > 0}
    <div
      class="flex-shrink-0 flex flex-col gap-0.5 px-2 pt-1.5 pb-0 border-b border-[var(--color-border-divider)] bg-[var(--color-macos-surface)] overflow-x-hidden"
    >
      {#if tabBarMode === 'pager'}
        <div class="flex items-center gap-1.5 min-w-0" role="tablist">
          <button
            type="button"
            class="pager-nav"
            aria-label="previous tabs"
            disabled={firstVisibleIndex <= 0}
            onclick={() => shiftPager(-1)}
          >
            <svg class="pager-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          <div class="flex-1 min-w-0 overflow-hidden py-0.5" use:attachResize>
            <div class="flex items-center gap-0.5 min-w-0">
              {#each visibleTabsPager as tab (tab.id)}
                <div
                  role="tab"
                  tabindex="0"
                  aria-selected={$activeTabId === tab.id}
                  class="group flex items-center gap-1 min-w-0 flex-1 max-w-[240px] rounded-t-lg border border-b-0 font-mono text-sm transition-colors cursor-pointer
                    {$activeTabId === tab.id
                    ? 'bg-[var(--color-surface-code)] border-[var(--color-border-divider)] text-[var(--color-info-text)] z-[1]'
                    : 'bg-[var(--color-surface-input)] border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-info-text)] hover:bg-[var(--color-surface-hover)]'}"
                  onclick={() => void activateTab(tab.id)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void activateTab(tab.id);
                    }
                  }}
                >
                  <div class="flex items-center gap-1.5 min-w-0 flex-1 px-2 py-1.5 pl-3">
                    <span class="truncate" title={tab.key}>{tabTitle(tab.key)}</span>
                    <span class="flex-shrink-0 text-[10px] text-[var(--color-text-faint)]">db{tab.db}</span>
                    <span
                      class="flex-shrink-0 truncate max-w-[72px] text-[10px] text-[var(--color-text-faint)]"
                      title={tab.connectionLabel}
                    >
                      {tab.connectionLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    class="flex-shrink-0 w-7 min-h-[2.25rem] flex items-center justify-center rounded-tr-lg text-[var(--color-text-faint)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors"
                    aria-label="close tab"
                    onclick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <button
            type="button"
            class="pager-nav"
            aria-label="next tabs"
            disabled={firstVisibleIndex >= maxStartIndex}
            onclick={() => shiftPager(1)}
          >
            <svg class="pager-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          <div
            class="flex items-center gap-0.5 flex-shrink-0 pl-1 border-l border-[var(--color-border-subtle)] ml-0.5"
          >
            <span class="text-[10px] text-[var(--color-text-faint)] font-mono hidden sm:inline">tabs</span>
            <button type="button" class="mode-chip mode-chip-on" onclick={() => (tabBarMode = 'pager')}>
              翻动
            </button>
            <button type="button" class="mode-chip" onclick={() => (tabBarMode = 'wrap')}>
              多行
            </button>
          </div>
        </div>
      {:else}
        <!-- 与标签同一行对齐，避免单独一行工具栏在上方形成空白带 -->
        <div class="flex items-start gap-2 min-w-0 pb-0.5">
          <div
            class="flex flex-1 min-w-0 flex-wrap items-center gap-0.5 overflow-x-hidden content-start"
            role="tablist"
          >
            {#each $keyTabs as tab (tab.id)}
            <div
              role="tab"
              tabindex="0"
              aria-selected={$activeTabId === tab.id}
              class="group flex items-center gap-1 w-[min(100%,240px)] min-w-[160px] flex-1 sm:flex-none sm:max-w-[240px] rounded-t-lg border border-b-0 font-mono text-sm transition-colors cursor-pointer
                {$activeTabId === tab.id
                ? 'bg-[var(--color-surface-code)] border-[var(--color-border-divider)] text-[var(--color-info-text)] z-[1]'
                : 'bg-[var(--color-surface-input)] border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-info-text)] hover:bg-[var(--color-surface-hover)]'}"
              onclick={() => void activateTab(tab.id)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void activateTab(tab.id);
                }
              }}
            >
              <div class="flex items-center gap-1.5 min-w-0 flex-1 px-2 py-1.5 pl-3">
                <span class="truncate" title={tab.key}>{tabTitle(tab.key)}</span>
                <span class="flex-shrink-0 text-[10px] text-[var(--color-text-faint)]">db{tab.db}</span>
                <span
                  class="flex-shrink-0 truncate max-w-[72px] text-[10px] text-[var(--color-text-faint)]"
                  title={tab.connectionLabel}
                >
                  {tab.connectionLabel}
                </span>
              </div>
              <button
                type="button"
                class="flex-shrink-0 w-7 min-h-[2.25rem] flex items-center justify-center rounded-tr-lg text-[var(--color-text-faint)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] transition-colors"
                aria-label="close tab"
                onclick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
            {/each}
          </div>
          <div
            class="flex items-center gap-0.5 flex-shrink-0 self-start pt-0.5 pl-2 border-l border-[var(--color-border-subtle)]"
          >
            <span class="text-[10px] text-[var(--color-text-faint)] font-mono hidden sm:inline">tabs</span>
            <button type="button" class="mode-chip" onclick={() => (tabBarMode = 'pager')}>
              翻动
            </button>
            <button type="button" class="mode-chip mode-chip-on" onclick={() => (tabBarMode = 'wrap')}>
              多行
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <KeyDetail />
  </div>
</div>

<style>
  .pager-nav {
    display: flex;
    height: 2.25rem;
    width: 2.25rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border-divider);
    background: var(--color-surface-input);
    color: var(--color-text-muted);
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease,
      transform 0.1s ease;
  }
  .pager-nav:not(:disabled):hover {
    border-color: var(--color-accent);
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }
  .pager-nav:not(:disabled):active {
    transform: scale(0.96);
  }
  .pager-nav:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }
  .pager-nav-icon {
    width: 1.125rem;
    height: 1.125rem;
  }
  .mode-chip {
    padding: 0.125rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    border: 1px solid transparent;
    color: var(--color-text-muted);
    background: transparent;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease;
  }
  .mode-chip:hover {
    background: var(--color-surface-hover);
    color: var(--color-info-text);
  }
  .mode-chip-on {
    border-color: var(--color-border-divider);
    background: var(--color-surface-code);
    color: var(--color-info-text);
  }
</style>
