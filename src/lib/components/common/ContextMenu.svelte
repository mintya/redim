<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { Trash2 } from '@lucide/svelte';

  interface MenuItem {
    label: string;
    action: () => void;
    danger?: boolean;
    icon?: ComponentType;
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
  class="context-menu fixed bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-md)] py-1 z-50 min-w-[140px]"
  style="left: {x}px; top: {y}px;"
>
  {#each items as item}
    <button
      class="w-full px-3 py-2 text-left text-base font-sans transition-colors flex items-center gap-2 {item.danger ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'}"
      onclick={() => handleItemClick(item)}
    >
      {#if item.icon}
        {@const Icon = item.icon}
        <Icon class="w-4 h-4" />
      {:else if item.danger}
        <Trash2 class="w-4 h-4" />
      {/if}
      {item.label}
    </button>
  {/each}
</div>
