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
    if (e.target === e.currentTarget) handleClose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-[var(--color-text-primary)]/5 backdrop-blur-[1px] flex items-center justify-center z-50" onclick={handleBackdropClick} onkeydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[8px] w-full {sizeClasses[size]} mx-3 shadow-[var(--shadow-md)]">
      {#if title}
        <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
          <span class="font-sans text-sm text-[var(--color-text-primary)] font-semibold">{title}</span>
          <button onclick={handleClose} class="ui-btn ui-btn-ghost ui-btn-icon">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      {/if}
      <div class="p-3">
        {@render children()}
      </div>
    </div>
  </div>
{/if}
