<script lang="ts">
  import { X } from '@lucide/svelte';
  
  interface Props {
    open: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    onclose?: () => void;
    children: any;
  }

  let { open = $bindable(), title = '', size = 'md', onclose, children }: Props = $props();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-xl',
  };

  function handleClose() {
    open = false;
    onclose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-[var(--color-text-primary)]/5 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full {sizeClasses[size]} mx-4 shadow-[var(--shadow-md)]">
      {#if title}
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <span class="font-sans text-base text-[var(--color-text-primary)] font-semibold">{title}</span>
          <button
            onclick={handleClose}
            class="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded-full hover:bg-[var(--color-surface-hover)]"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      {/if}
      <div class="p-4">
        {@render children()}
      </div>
    </div>
  </div>
{/if}
