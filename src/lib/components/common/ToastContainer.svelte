<script lang="ts">
  import { toasts, removeToast } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';
</script>

{#if $toasts.length > 0}
  <div class="fixed top-12 right-4 z-[100] flex flex-col gap-2 max-w-sm">
    {#each $toasts as toast (toast.id)}
      <div
        class="px-4 py-3 rounded-lg shadow-[var(--shadow-md)] border flex items-start gap-2 font-mono text-base"
        class:bg-[var(--color-accent-subtle)]={toast.type === 'error'}
        class:border-[var(--color-accent)]={toast.type === 'error'}
        class:text-[var(--color-accent)]={toast.type === 'error'}
        class:bg-[var(--color-surface)]={toast.type === 'info'}
        class:border-[var(--color-border)]={toast.type === 'info'}
        class:text-[var(--color-text-primary)]={toast.type === 'info'}
        in:fly={{ x: 200, duration: 200 }}
        out:fly={{ x: 200, duration: 150 }}
      >
        <span class="flex-1">{toast.message}</span>
        <button
          class="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
          onclick={() => removeToast(toast.id)}
        >
          ✕
        </button>
      </div>
    {/each}
  </div>
{/if}
