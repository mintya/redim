<script lang="ts">
  import { onMount, onDestroy, type Snippet } from 'svelte';

  interface Props {
    items: any[];
    itemHeight: number;
    overscan?: number;
    item: Snippet<[any, number]>;
    getKey?: (item: any, index: number) => string | number;
    onItemClick?: (item: any, index: number) => void;
    onItemContextMenu?: (item: any, index: number, event: MouseEvent) => void;
    selectedKey?: string | null;
    className?: string;
  }

  let {
    items,
    itemHeight,
    overscan = 5,
    item: itemSnippet,
    getKey = (_, index) => index,
    onItemClick,
    onItemContextMenu,
    selectedKey = null,
    className = ''
  }: Props = $props();

  let container: HTMLDivElement;
  let scrollTop = $state(0);
  let containerHeight = $state(0);

  // 计算可见范围
  let startIndex = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - overscan));
  let endIndex = $derived(Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  ));

  // 可见项
  let visibleItems = $derived(items.slice(startIndex, endIndex).map((item, i) => ({
    item,
    index: startIndex + i,
    key: getKey(item, startIndex + i)
  })));

  // 总高度
  let totalHeight = $derived(items.length * itemHeight);

  // 偏移量
  let offsetY = $derived(startIndex * itemHeight);

  function handleScroll() {
    if (container) {
      scrollTop = container.scrollTop;
    }
  }

  onMount(() => {
    if (container) {
      containerHeight = container.clientHeight;
      container.addEventListener('scroll', handleScroll);
    }
  });

  onDestroy(() => {
    if (container) {
      container.removeEventListener('scroll', handleScroll);
    }
  });

  // 滚动到指定索引
  export function scrollToIndex(index: number) {
    if (container) {
      const targetScrollTop = index * itemHeight;
      container.scrollTop = targetScrollTop;
    }
  }
</script>

<div 
  bind:this={container}
  class="overflow-y-auto h-full {className}"
>
  <div style="height: {totalHeight}px; position: relative;">
    <div style="position: absolute; top: {offsetY}px; left: 0; right: 0;">
      {#each visibleItems as { item, index, key } (key)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          style="height: {itemHeight}px;"
          class="cursor-pointer transition-all duration-200 border-b border-[var(--color-macos-border)] 
            {selectedKey !== null && selectedKey === item ? 'bg-[var(--color-accent-subtle)]' : 'hover:bg-[var(--color-surface-hover)]'}"
          onclick={() => onItemClick?.(item, index)}
          oncontextmenu={(e) => onItemContextMenu?.(item, index, e)}
        >
          {@render itemSnippet(item, index)}
        </div>
      {/each}
    </div>
  </div>
</div>
