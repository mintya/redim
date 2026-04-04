<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'error';
    onClose: () => void;
  }

  let { 
    open = $bindable(), 
    title = 'alert',
    message,
    type = 'info',
    onClose
  }: Props = $props();

  function handleClose() {
    open = false;
    onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      handleClose();
    }
  }

  function getTypeColor() {
    switch (type) {
      case 'success': return 'text-[var(--color-success)]';
      case 'error': return 'text-[var(--color-accent)]';
      default: return 'text-[var(--color-info-text)]';
    }
  }

  function getIcon() {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      default: return 'ℹ';
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="bg-[var(--color-surface-input)] border border-[var(--color-border-divider)] rounded-xl w-full max-w-sm shadow-lg">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--color-border-divider)] flex items-center gap-2">
        <span class="text-base {getTypeColor()}">{getIcon()}</span>
        <span class="text-base text-[var(--color-info-text)] font-mono">{title}</span>
      </div>
      
      <!-- Content -->
      <div class="px-4 py-4">
        <p class="text-base text-[var(--color-info-text)] font-mono">{message}</p>
      </div>
      
      <!-- Actions -->
      <div class="px-4 py-3 border-t border-[var(--color-border-divider)] flex justify-end">
        <button 
          class="px-4 py-2 text-base font-mono bg-[var(--color-dark-bg)] text-white rounded hover:bg-[var(--color-dark-border)] transition-colors"
          onclick={handleClose}
        >
          ok
        </button>
      </div>
    </div>
  </div>
{/if}
