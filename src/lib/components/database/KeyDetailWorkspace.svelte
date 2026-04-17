<script lang="ts">
  import { untrack } from 'svelte';
  import { keyTabs, activeTabId, activateTab, closeTab } from '$lib/stores/database';
  import KeyDetail from './KeyDetail.svelte';
  import { ChevronLeft, ChevronRight, X, List, LayoutGrid } from '@lucide/svelte';

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

<div class="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden min-w-0">
  {#if $keyTabs.length > 0}
    <div
      class="flex-shrink-0 flex flex-col gap-0.5 px-2 pt-1.5 pb-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-hidden"
    >
      {#if tabBarMode === 'pager'}
        <div class="flex items-center gap-1 min-w-0" role="tablist">
          <button
            type="button"
            class="pager-nav"
            aria-label="previous tabs"
            disabled={firstVisibleIndex <= 0}
            onclick={() => shiftPager(-1)}
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <div class="flex-1 min-w-0 overflow-hidden" use:attachResize>
            <div class="flex items-center min-w-0">
              {#each visibleTabsPager as tab (tab.id)}
                <div
                  role="tab"
                  tabindex="0"
                  aria-selected={$activeTabId === tab.id}
                  class="group flex items-center gap-1 min-w-0 max-w-[200px] flex-1 font-sans text-sm transition-all cursor-pointer rounded-t-md
                    {$activeTabId === tab.id
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] border-t border-l border-r border-[var(--color-border)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'}"
                  onclick={() => void activateTab(tab.id)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void activateTab(tab.id);
                    }
                  }}
                >
                  <div class="flex items-center gap-1 min-w-0 flex-1 px-2 py-1.5 pl-3">
                    <span class="truncate" title={tab.key}>{tabTitle(tab.key, 20)}</span>
                    <span class="flex-shrink-0 text-[10px] text-[var(--color-text-muted)]">db{tab.db}</span>
                  </div>
                  <button
                    type="button"
                    class="flex-shrink-0 w-6 h-6 flex items-center justify-center mr-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    aria-label="close tab"
                    onclick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    <X class="w-3.5 h-3.5" />
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
            <ChevronRight class="w-4 h-4" />
          </button>

          <div class="flex items-center gap-0.5 flex-shrink-0 ml-1">
            <button type="button" class="mode-chip {tabBarMode === 'pager' ? 'mode-chip-on' : ''}" onclick={() => (tabBarMode = 'pager')} title="Scroll">
              <List class="w-3.5 h-3.5" />
            </button>
            <button type="button" class="mode-chip {tabBarMode === 'wrap' ? 'mode-chip-on' : ''}" onclick={() => (tabBarMode = 'wrap')} title="Wrap">
              <LayoutGrid class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      {:else}
        <div class="flex items-start gap-1 min-w-0 pb-0.5">
          <div
            class="flex flex-1 min-w-0 flex-wrap items-center gap-0.5 overflow-x-hidden content-start"
            role="tablist"
          >
            {#each $keyTabs as tab (tab.id)}
            <div
              role="tab"
              tabindex="0"
              aria-selected={$activeTabId === tab.id}
              class="group flex items-center gap-1 w-[min(100%,200px)] min-w-[140px] flex-1 sm:flex-none sm:max-w-[200px] rounded-t-md font-sans text-sm transition-all cursor-pointer
                {$activeTabId === tab.id
                ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] border-t border-l border-r border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'}"
              onclick={() => void activateTab(tab.id)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void activateTab(tab.id);
                }
              }}
            >
              <div class="flex items-center gap-1 min-w-0 flex-1 px-2 py-1.5 pl-3">
                <span class="truncate" title={tab.key}>{tabTitle(tab.key, 20)}</span>
                <span class="flex-shrink-0 text-[10px] text-[var(--color-text-muted)]">db{tab.db}</span>
              </div>
              <button
                type="button"
                class="flex-shrink-0 w-6 h-6 flex items-center justify-center mr-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                aria-label="close tab"
                onclick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
            {/each}
          </div>
          <div
            class="flex items-center gap-0.5 flex-shrink-0 self-start pt-0.5"
          >
            <button type="button" class="mode-chip {tabBarMode === 'pager' ? 'mode-chip-on' : ''}" onclick={() => (tabBarMode = 'pager')} title="Scroll">
              <List class="w-3.5 h-3.5" />
            </button>
            <button type="button" class="mode-chip {tabBarMode === 'wrap' ? 'mode-chip-on' : ''}" onclick={() => (tabBarMode = 'wrap')} title="Wrap">
              <LayoutGrid class="w-3.5 h-3.5" />
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
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text-secondary);
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease,
      transform 0.1s ease;
  }
  .pager-nav:not(:disabled):hover {
    border-color: var(--color-text-primary);
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
  .pager-nav:not(:disabled):active {
    transform: scale(0.96);
  }
  .pager-nav:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }
  .mode-chip {
    padding: 0.25rem;
    border-radius: 0.375rem;
    font-size: 10px;
    border: 1px solid transparent;
    color: var(--color-text-secondary);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease;
  }
  .mode-chip:hover {
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
  .mode-chip-on {
    border-color: var(--color-border);
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
  }
</style>
