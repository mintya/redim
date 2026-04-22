<script lang="ts">
  import { toasts, removeToast } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';
  import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from '@lucide/svelte';
</script>

{#if $toasts.length > 0}
  <div class="fixed top-11 right-3 z-[100] flex flex-col gap-1.5 max-w-[360px]">
    {#each $toasts as toast (toast.id)}
      <div
        class="px-3 py-2 rounded-[6px] shadow-[var(--shadow-sm)] border flex items-start gap-2 text-xs font-sans"
        class:bg-[var(--color-accent-subtle)]={toast.type === 'error'}
        class:border-[var(--color-accent)]={toast.type === 'error'}
        class:text-[var(--color-accent)]={toast.type === 'error'}
        class:bg-[var(--color-surface)]={toast.type === 'info' || toast.type === 'success'}
        class:border-[var(--color-border)]={toast.type === 'info' || toast.type === 'success' || toast.type === 'warning'}
        class:text-[var(--color-text-primary)]={toast.type === 'info' || toast.type === 'success' || toast.type === 'warning'}
        class:bg-[var(--color-bg-elevated)]={toast.type === 'warning'}
        in:fly={{ x: 200, duration: 200 }}
        out:fly={{ x: 200, duration: 150 }}
      >
        {#if toast.type === 'success'}
          <CheckCircle2 class="w-4 h-4 mt-0.5 text-[var(--color-type-string)] flex-shrink-0" />
        {:else if toast.type === 'error'}
          <CircleAlert class="w-4 h-4 mt-0.5 flex-shrink-0" />
        {:else if toast.type === 'warning'}
          <TriangleAlert class="w-4 h-4 mt-0.5 text-[var(--color-type-hash)] flex-shrink-0" />
        {:else}
          <Info class="w-4 h-4 mt-0.5 text-[var(--color-text-secondary)] flex-shrink-0" />
        {/if}

        <span class="flex-1 whitespace-pre-line leading-5">{toast.message}</span>
        <button
          class="ui-btn ui-btn-ghost ui-btn-icon -mr-1 text-current opacity-55 hover:opacity-100 flex-shrink-0"
          onclick={() => removeToast(toast.id)}
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    {/each}
  </div>
{/if}
