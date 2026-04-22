<script lang="ts">
  import { keyTabs, activeTabId, activateTab, closeTab, reorderKeyTab } from '$lib/stores/database';
  import KeyDetail from './KeyDetail.svelte';
  import { ChevronLeft, ChevronRight, X, List, LayoutGrid } from '@lucide/svelte';

  type TabBarMode = 'single' | 'multi';

  const TAB_FADE_PADDING = 20;

  let tabBarMode = $state<TabBarMode>('single');
  let singleLineEl = $state<HTMLDivElement | null>(null);
  let singleScroll = $state({ left: 0, max: 0 });
  let syncedActiveTabId = $state<string | null>(null);
  let draggingTabId = $state<string | null>(null);
  let dropTargetTabId = $state<string | null>(null);
  let dropPosition = $state<'before' | 'after' | null>(null);

  let canPrev = $derived(singleScroll.left > 1);
  let canNext = $derived(singleScroll.left < singleScroll.max - 1);
  let activeTabIndex = $derived.by(() => {
    if (!$activeTabId) return -1;
    return $keyTabs.findIndex((tab) => tab.id === $activeTabId);
  });

  function compactConnectionLabel(label: string, max = 10): string {
    const text = label.trim();
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}...`;
  }

  function tabMetaText(tab: { db: number; connectionLabel: string }): string {
    const shortLabel = compactConnectionLabel(tab.connectionLabel);
    return shortLabel ? `db${tab.db} · ${shortLabel}` : `db${tab.db}`;
  }

  function updateSingleScrollState() {
    if (!singleLineEl) {
      singleScroll = { left: 0, max: 0 };
      return;
    }
    singleScroll = {
      left: singleLineEl.scrollLeft,
      max: Math.max(0, singleLineEl.scrollWidth - singleLineEl.clientWidth),
    };
  }

  function attachSingleViewport(node: HTMLDivElement) {
    singleLineEl = node;
    const onScroll = () => updateSingleScrollState();
    const ro = new ResizeObserver(() => updateSingleScrollState());
    node.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(node);
    updateSingleScrollState();

    return {
      destroy() {
        node.removeEventListener('scroll', onScroll);
        ro.disconnect();
        if (singleLineEl === node) singleLineEl = null;
      },
    };
  }

  function ensureActiveTabVisible(activeId: string) {
    const container = singleLineEl;
    if (!container) return;
    const target = container.querySelector(`[data-tab-id="${activeId}"]`) as HTMLElement | null;
    if (!target) return;

    const visibleLeft = container.scrollLeft;
    const visibleRight = visibleLeft + container.clientWidth;
    const targetLeft = target.offsetLeft;
    const targetRight = targetLeft + target.offsetWidth;
    let nextLeft = visibleLeft;

    if (targetRight > visibleRight - TAB_FADE_PADDING) {
      nextLeft = targetRight - container.clientWidth + TAB_FADE_PADDING;
    } else if (targetLeft < visibleLeft + TAB_FADE_PADDING) {
      nextLeft = targetLeft - TAB_FADE_PADDING;
    }

    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    nextLeft = Math.max(0, Math.min(maxLeft, nextLeft));

    if (Math.abs(nextLeft - visibleLeft) > 1) {
      container.scrollTo({ left: nextLeft, behavior: 'smooth' });
    }
  }

  function activateAdjacentTab(delta: number) {
    if ($keyTabs.length === 0) return;
    const current = activeTabIndex >= 0 ? activeTabIndex : 0;
    const next = Math.max(0, Math.min($keyTabs.length - 1, current + delta));
    if (next !== current) {
      void activateTab($keyTabs[next].id);
    }
  }

  function handleTabKeydown(e: KeyboardEvent, tabId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void activateTab(tabId);
      return;
    }
    if (e.key === 'ArrowLeft') {
      if (tabBarMode === 'single') {
        e.preventDefault();
        activateAdjacentTab(-1);
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      if (tabBarMode === 'single') {
        e.preventDefault();
        activateAdjacentTab(1);
      }
      return;
    }
    const isCloseShortcut =
      e.key === 'Delete' ||
      e.key === 'Backspace' ||
      (e.key.toLowerCase() === 'w' && (e.metaKey || e.ctrlKey));
    if (isCloseShortcut) {
      e.preventDefault();
      closeTab(tabId);
    }
  }

  function handleCloseTab(e: MouseEvent, tabId: string) {
    e.stopPropagation();
    closeTab(tabId);
  }

  function clearTabDragState() {
    draggingTabId = null;
    dropTargetTabId = null;
    dropPosition = null;
  }

  function tabDragClass(tabId: string): string {
    return draggingTabId === tabId ? 'ui-tab-dragging' : '';
  }

  function tabDropClass(tabId: string): string {
    if (!dropPosition || dropTargetTabId !== tabId) return '';
    return dropPosition === 'before' ? 'ui-tab-drop-before' : 'ui-tab-drop-after';
  }

  function handleTabDragStart(e: DragEvent, tabId: string) {
    draggingTabId = tabId;
    dropTargetTabId = null;
    dropPosition = null;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tabId);
    }
  }

  function handleTabDragOver(e: DragEvent, tabId: string) {
    if (!draggingTabId || draggingTabId === tabId) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dropTargetTabId = tabId;
    dropPosition = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleTabDrop(e: DragEvent, tabId: string) {
    if (!draggingTabId) return;
    e.preventDefault();
    const fromId = draggingTabId;
    const targetId = tabId;
    const pos = dropPosition;
    clearTabDragState();
    if (fromId === targetId || !pos) return;

    const tabs = $keyTabs;
    const fromIndex = tabs.findIndex((tab) => tab.id === fromId);
    const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
    if (fromIndex < 0 || targetIndex < 0) return;

    let toIndex = pos === 'before' ? targetIndex : targetIndex + 1;
    if (fromIndex < toIndex) toIndex -= 1;
    reorderKeyTab(fromId, toIndex);

    requestAnimationFrame(() => {
      if (tabBarMode === 'single') {
        const aid = $activeTabId;
        if (aid) ensureActiveTabVisible(aid);
        updateSingleScrollState();
      }
    });
  }

  function handleTabDragEnd() {
    clearTabDragState();
  }

  $effect(() => {
    tabBarMode;
    $keyTabs.length;
    requestAnimationFrame(() => updateSingleScrollState());
    if (tabBarMode !== 'single') {
      syncedActiveTabId = null;
    }
    if (draggingTabId && !$keyTabs.find((tab) => tab.id === draggingTabId)) {
      clearTabDragState();
    }
  });

  $effect(() => {
    if (tabBarMode !== 'single') return;
    const aid = $activeTabId;
    if (!aid || aid === syncedActiveTabId) return;

    syncedActiveTabId = aid;
    requestAnimationFrame(() => {
      ensureActiveTabVisible(aid);
      updateSingleScrollState();
    });
  });
</script>

<div class="h-full min-h-0 flex flex-col bg-[var(--color-surface)] overflow-hidden min-w-0">
  {#if $keyTabs.length > 0}
    <div class="flex-shrink-0 ui-tab-strip">
      <div class="flex items-center gap-2 px-2 py-1">
        <span class="ui-subtle">{$keyTabs.length} tabs</span>
        <div class="ml-auto ui-segment ui-tab-mode-switch">
          <button
            type="button"
            class="ui-segment-item {tabBarMode === 'single' ? 'ui-segment-item-active' : ''}"
            onclick={() => (tabBarMode = 'single')}
            title="single line"
          >
            <List class="w-3 h-3" />
          </button>
          <button
            type="button"
            class="ui-segment-item {tabBarMode === 'multi' ? 'ui-segment-item-active' : ''}"
            onclick={() => (tabBarMode = 'multi')}
            title="multi line"
          >
            <LayoutGrid class="w-3 h-3" />
          </button>
        </div>
      </div>

      {#if tabBarMode === 'single'}
        <div class="flex items-center gap-1 px-2">
          <button
            type="button"
            class="ui-btn ui-btn-ghost ui-btn-icon"
            aria-label="previous tab"
            disabled={activeTabIndex <= 0}
            onclick={() => activateAdjacentTab(-1)}
          >
            <ChevronLeft class="w-3.5 h-3.5" />
          </button>

          <div class="relative flex-1 min-w-0 overflow-hidden">
            <div
              role="tablist"
              class="ui-tab-scroll-no-bar flex items-end flex-nowrap gap-1 overflow-x-auto overflow-y-visible pr-1 pt-1"
              use:attachSingleViewport
            >
              {#each $keyTabs as tab (tab.id)}
                <div
                  role="tab"
                  tabindex="0"
                  data-tab-id={tab.id}
                  aria-selected={$activeTabId === tab.id}
                  class="ui-tab ui-tab-single {$activeTabId === tab.id ? 'ui-tab-active' : ''} {tabDragClass(tab.id)} {tabDropClass(tab.id)}"
                  draggable="true"
                  onclick={() => void activateTab(tab.id)}
                  onkeydown={(e) => handleTabKeydown(e, tab.id)}
                  ondragstart={(e) => handleTabDragStart(e, tab.id)}
                  ondragover={(e) => handleTabDragOver(e, tab.id)}
                  ondrop={(e) => handleTabDrop(e, tab.id)}
                  ondragend={handleTabDragEnd}
                >
                  <span class="ui-tab-title" title={tab.key}>{tab.key}</span>
                  {#if $activeTabId === tab.id}
                    <span class="ui-tab-meta" title={tabMetaText(tab)}>{tabMetaText(tab)}</span>
                  {/if}
                  <button
                    type="button"
                    class="ui-btn ui-btn-ghost ui-btn-icon-sm ui-tab-close"
                    aria-label="close tab"
                    draggable="false"
                    onclick={(e) => handleCloseTab(e, tab.id)}
                  >
                    <X class="ui-tab-close-icon w-3 h-3" />
                  </button>
                </div>
              {/each}
            </div>
            {#if canPrev}
              <div class="ui-tab-fade-left"></div>
            {/if}
            {#if canNext}
              <div class="ui-tab-fade-right"></div>
            {/if}
          </div>

          <button
            type="button"
            class="ui-btn ui-btn-ghost ui-btn-icon"
            aria-label="next tab"
            disabled={activeTabIndex < 0 || activeTabIndex >= $keyTabs.length - 1}
            onclick={() => activateAdjacentTab(1)}
          >
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      {:else}
        <div class="px-2">
          <div role="tablist" class="ui-tab-grid grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-1">
            {#each $keyTabs as tab (tab.id)}
              <div
                role="tab"
                tabindex="0"
                aria-selected={$activeTabId === tab.id}
                class="ui-tab ui-tab-multi {$activeTabId === tab.id ? 'ui-tab-active' : ''} {tabDragClass(tab.id)} {tabDropClass(tab.id)}"
                draggable="true"
                onclick={() => void activateTab(tab.id)}
                onkeydown={(e) => handleTabKeydown(e, tab.id)}
                ondragstart={(e) => handleTabDragStart(e, tab.id)}
                ondragover={(e) => handleTabDragOver(e, tab.id)}
                ondrop={(e) => handleTabDrop(e, tab.id)}
                ondragend={handleTabDragEnd}
              >
                <span class="ui-tab-title" title={tab.key}>{tab.key}</span>
                {#if $activeTabId === tab.id}
                  <span class="ui-tab-meta" title={tabMetaText(tab)}>{tabMetaText(tab)}</span>
                {/if}
                <button
                  type="button"
                  class="ui-btn ui-btn-ghost ui-btn-icon-sm ui-tab-close"
                  aria-label="close tab"
                  draggable="false"
                  onclick={(e) => handleCloseTab(e, tab.id)}
                >
                  <X class="ui-tab-close-icon w-3 h-3" />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <KeyDetail />
  </div>
</div>
