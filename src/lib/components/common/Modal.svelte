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
  <div class="fixed inset-0 flex items-center justify-center z-50 glass-backdrop" onclick={handleBackdropClick} onkeydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="ui-panel w-full {sizeClasses[size]} mx-3 shadow-[var(--shadow-glass-lg)]">
      {#if title}
        <div class="ui-panel-header">
          <span class="ui-title">{title}</span>
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
