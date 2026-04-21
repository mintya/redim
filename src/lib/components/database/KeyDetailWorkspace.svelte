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

  $effect(() => {
    const aid = $activeTabId;
    const tabs = $keyTabs;
    const mv = maxVisible;

    untrack(() => {
      const ms = Math.max(0, tabs.length - mv);
      const idx = tabs.findIndex((t) => t.id === aid);
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

<div class="h-full min-h-0 flex flex-col bg-[var(--color-surface)] overflow-hidden min-w-0">
  {#if $keyTabs.length > 0}
    <div class="flex-shrink-0 flex flex-col px-2 py-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-hidden">
      {#if tabBarMode === 'pager'}
        <div class="flex items-center gap-1 min-w-0" role="tablist">
          <button type="button" class="ui-btn ui-btn-ghost ui-btn-icon" aria-label="previous tabs" disabled={firstVisibleIndex <= 0} onclick={() => shiftPager(-1)}>
            <ChevronLeft class="w-3.5 h-3.5" />
          </button>

          <div class="flex-1 min-w-0 overflow-hidden" use:attachResize>
            <div class="flex items-center min-w-0">
              {#each visibleTabsPager as tab (tab.id)}
                <div
                  role="tab"
                  tabindex="0"
                  aria-selected={$activeTabId === tab.id}
                  class="group flex items-center min-w-0 max-w-[200px] flex-1 text-xs transition-colors cursor-pointer rounded-t-[6px] {$activeTabId === tab.id
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
                  <div class="flex items-center gap-1 min-w-0 flex-1 px-2 py-1">
                    <span class="truncate" title={tab.key}>{tabTitle(tab.key, 20)}</span>
                    <span class="flex-shrink-0 text-[10px] text-[var(--color-text-muted)]">db{tab.db}</span>
                  </div>
                  <button
                    type="button"
                    class="ui-btn ui-btn-ghost ui-btn-icon-sm mr-0.5 flex-shrink-0"
                    aria-label="close tab"
                    onclick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <button type="button" class="ui-btn ui-btn-ghost ui-btn-icon" aria-label="next tabs" disabled={firstVisibleIndex >= maxStartIndex} onclick={() => shiftPager(1)}>
            <ChevronRight class="w-3.5 h-3.5" />
          </button>

          <div class="ui-segment flex-shrink-0 ml-1">
            <button type="button" class="ui-segment-item {tabBarMode === 'pager' ? 'ui-segment-item-active' : ''}" onclick={() => (tabBarMode = 'pager')} title="Scroll">
              <List class="w-3 h-3" />
            </button>
            <button type="button" class="ui-segment-item {tabBarMode === 'wrap' ? 'ui-segment-item-active' : ''}" onclick={() => (tabBarMode = 'wrap')} title="Wrap">
              <LayoutGrid class="w-3 h-3" />
            </button>
          </div>
        </div>
      {:else}
        <div class="flex items-start gap-1 min-w-0">
          <div class="flex flex-1 min-w-0 flex-wrap items-center gap-0.5 overflow-x-hidden content-start" role="tablist">
            {#each $keyTabs as tab (tab.id)}
              <div
                role="tab"
                tabindex="0"
                aria-selected={$activeTabId === tab.id}
                class="group flex items-center w-[min(100%,200px)] min-w-[130px] flex-1 sm:flex-none sm:max-w-[200px] rounded-t-[6px] text-xs transition-colors cursor-pointer {$activeTabId === tab.id
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
                <div class="flex items-center gap-1 min-w-0 flex-1 px-2 py-1">
                  <span class="truncate" title={tab.key}>{tabTitle(tab.key, 20)}</span>
                  <span class="flex-shrink-0 text-[10px] text-[var(--color-text-muted)]">db{tab.db}</span>
                </div>
                <button
                  type="button"
                  class="ui-btn ui-btn-ghost ui-btn-icon-sm mr-0.5 flex-shrink-0"
                  aria-label="close tab"
                  onclick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            {/each}
          </div>
          <div class="ui-segment flex-shrink-0 self-start">
            <button type="button" class="ui-segment-item {tabBarMode === 'pager' ? 'ui-segment-item-active' : ''}" onclick={() => (tabBarMode = 'pager')} title="Scroll">
              <List class="w-3 h-3" />
            </button>
            <button type="button" class="ui-segment-item {tabBarMode === 'wrap' ? 'ui-segment-item-active' : ''}" onclick={() => (tabBarMode = 'wrap')} title="Wrap">
              <LayoutGrid class="w-3 h-3" />
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
