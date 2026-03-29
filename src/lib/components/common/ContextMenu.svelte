<script lang="ts">
  interface MenuItem {
    label: string;
    action: () => void;
    danger?: boolean;
  }

  interface Props {
    x: number;
    y: number;
    items: MenuItem[];
    onclose: () => void;
  }

  let { x, y, items, onclose }: Props = $props();

  function handleItemClick(item: MenuItem) {
    item.action();
    onclose();
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.context-menu')) {
      onclose();
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="context-menu fixed bg-[#f8f8f8] border border-[#d4d4d4] rounded shadow-lg py-1 z-50 min-w-[120px]"
  style="left: {x}px; top: {y}px;"
>
  {#each items as item}
    <button
      class="w-full px-3 py-1.5 text-left text-sm font-mono transition-colors {item.danger ? 'text-[#dc382d] hover:bg-[#fdf0ef]' : 'text-[#1a1a1a] hover:bg-[#f0f0f0]'}"
      onclick={() => handleItemClick(item)}
    >
      {item.label}
    </button>
  {/each}
</div>
