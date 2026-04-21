<script lang="ts">
  import { CheckCircle, XCircle, Info } from '@lucide/svelte';
  
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
      case 'success': return 'text-[var(--color-type-string)]';
      case 'error': return 'text-[var(--color-accent)]';
      default: return 'text-[var(--color-text-secondary)]';
    }
  }

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
  };
  
  let IconComponent = $derived(icons[type]);
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-[var(--color-text-primary)]/5 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-sm shadow-[var(--shadow-md)]">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
        <IconComponent class="w-5 h-5 {getTypeColor()}" />
        <span class="text-base text-[var(--color-text-primary)] font-sans">{title}</span>
      </div>
      
      <!-- Content -->
      <div class="px-4 py-4">
        <p class="text-base text-[var(--color-text-primary)] font-sans">{message}</p>
      </div>
      
      <!-- Actions -->
      <div class="px-4 py-3 border-t border-[var(--color-border)] flex justify-end">
        <button 
          class="px-4 py-2 text-base font-sans bg-[var(--color-text-primary)] text-[var(--color-surface)] rounded-md hover:opacity-90 transition-colors"
          onclick={handleClose}
        >
          ok
        </button>
      </div>
    </div>
  </div>
{/if}
