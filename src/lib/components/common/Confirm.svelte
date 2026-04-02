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
    class="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-2xl w-full max-w-sm shadow-lg">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--color-macos-border)]">
        <span class="text-base text-[var(--color-macos-text)] font-semibold">{title}</span>
      </div>
      
      <!-- Content -->
      <div class="px-4 py-4">
        <p class="text-base text-[var(--color-macos-text)]">{message}</p>
      </div>
      
      <!-- Actions -->
      <div class="px-4 py-3 border-t border-[var(--color-macos-border)] flex justify-end gap-2">
        <button 
          class="px-4 py-2 text-base font-medium text-[var(--color-macos-text-secondary)] hover:text-[var(--color-macos-text)] transition-colors rounded-lg hover:bg-[#f5f5f7]"
          onclick={handleCancel}
        >
          {cancelText}
        </button>
        <button 
          class="px-4 py-2 text-base font-medium rounded-lg transition-colors {danger ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-light)]' : 'bg-[var(--color-macos-text)] text-white hover:bg-[#333]'}"
          onclick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
