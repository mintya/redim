<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    icon: Component;
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
    <Icon {size} />
  </button>
{:else}
  <span class={className}>
    <Icon {size} />
  </span>
{/if}
