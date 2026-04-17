<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ComponentType } from 'svelte';

  interface Props {
    icon: ComponentType;
    size?: number;
    class?: string;
    onclick?: () => void;
  }

  let { icon: Icon, size = 16, class: className = '', onclick }: Props = $props();
</script>

{#if onclick}
  <button
    type="button"
    class={className}
    onclick={onclick}
  >
    <svelte:component this={Icon} {size} />
  </button>
{:else}
  <span class={className}>
    <svelte:component this={Icon} {size} />
  </span>
{/if}