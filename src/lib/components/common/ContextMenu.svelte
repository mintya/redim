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
  class="context-menu fixed bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-xl shadow-lg py-1 z-50 min-w-[120px]"
  style="left: {x}px; top: {y}px;"
>
  {#each items as item}
    <button
      class="w-full px-3 py-2 text-left text-base font-mono transition-colors {item.danger ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]' : 'text-[var(--color-macos-text)] hover:bg-[#f5f5f7]'}"
      onclick={() => handleItemClick(item)}
    >
      {item.label}
    </button>
  {/each}
</div>
