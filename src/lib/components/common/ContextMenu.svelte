<script lang="ts">
  import type { Component } from 'svelte';
  import { Trash2 } from '@lucide/svelte';

  interface MenuItem {
    label: string;
    action: () => void;
    danger?: boolean;
    icon?: Component;
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
    if (!target.closest('.context-menu')) onclose();
  }
</script>

<svelte:window onclick={handleClickOutside} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="context-menu ui-menu-panel fixed py-1 z-[200] min-w-[132px]" style="left: {x}px; top: {y}px;">
  {#each items as item}
    <button
      class="ui-menu-item justify-start {item.danger ? 'ui-menu-item-danger' : ''}"
      onclick={() => handleItemClick(item)}
    >
      {#if item.icon}
        {@const Icon = item.icon}
        <Icon class="w-3.5 h-3.5" />
      {:else if item.danger}
        <Trash2 class="w-3.5 h-3.5" />
      {/if}
      {item.label}
    </button>
  {/each}
</div>
