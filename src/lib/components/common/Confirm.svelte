<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { 
    open = $bindable(), 
    title = 'confirm',
    message,
    confirmText = 'confirm',
    cancelText = 'cancel',
    danger = false,
    onconfirm,
    oncancel
  }: Props = $props();

  function handleConfirm() {
    open = false;
    onconfirm();
  }

  function handleCancel() {
    open = false;
    oncancel();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter') {
      handleConfirm();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 bg-[var(--color-text-primary)]/20 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-sm shadow-[var(--shadow-md)]">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--color-border)]">
        <span class="text-base text-[var(--color-text-primary)] font-semibold">{title}</span>
      </div>
      
      <!-- Content -->
      <div class="px-4 py-4">
        <p class="text-base text-[var(--color-text-primary)]">{message}</p>
      </div>
      
      <!-- Actions -->
      <div class="px-4 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
        <button 
          class="px-4 py-2 text-base font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors rounded-md hover:bg-[var(--color-surface-hover)]"
          onclick={handleCancel}
        >
          {cancelText}
        </button>
        <button 
          class="px-4 py-2 text-base font-medium rounded-md transition-colors {danger ? 'bg-[var(--color-accent)] text-white hover:opacity-90' : 'bg-[var(--color-text-primary)] text-[var(--color-surface)] hover:opacity-90'}"
          onclick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
