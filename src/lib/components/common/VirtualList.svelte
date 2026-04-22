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
    rowClassName?: string;
    selectedClassName?: string;
    hoverClassName?: string;
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
    className = '',
    rowClassName = 'border-b border-[var(--color-border)]',
    selectedClassName = 'bg-[var(--color-accent-subtle)]',
    hoverClassName = 'hover:bg-[var(--color-surface-hover)]'
  }: Props = $props();

  let container: HTMLDivElement;
  let scrollTop = $state(0);
  let containerHeight = $state(0);

  let startIndex = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - overscan));
  let endIndex = $derived(Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan));

  let visibleItems = $derived(
    items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
      key: getKey(item, startIndex + i)
    }))
  );

  let totalHeight = $derived(items.length * itemHeight);
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

  export function scrollToIndex(index: number) {
    if (container) {
      container.scrollTop = index * itemHeight;
    }
  }
</script>

<div bind:this={container} class="overflow-y-auto h-full {className}">
  <div style="height: {totalHeight}px; position: relative;">
    <div style="position: absolute; top: {offsetY}px; left: 0; right: 0;">
      {#each visibleItems as { item, index, key } (key)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          style="height: {itemHeight}px;"
          class="cursor-pointer transition-colors {rowClassName} {selectedKey !== null && selectedKey === String(key) ? selectedClassName : hoverClassName}"
          onclick={() => onItemClick?.(item, index)}
          oncontextmenu={(e) => onItemContextMenu?.(item, index, e)}
        >
          {@render itemSnippet(item, index)}
        </div>
      {/each}
    </div>
  </div>
</div>
