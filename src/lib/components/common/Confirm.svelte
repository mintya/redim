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
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="bg-[#f8f8f8] border border-[#d4d4d4] rounded w-full max-w-sm shadow-lg">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[#d4d4d4]">
        <span class="text-xs text-[#1a1a1a] font-mono">{title}</span>
      </div>
      
      <!-- Content -->
      <div class="px-4 py-4">
        <p class="text-sm text-[#1a1a1a] font-mono">{message}</p>
      </div>
      
      <!-- Actions -->
      <div class="px-4 py-3 border-t border-[#d4d4d4] flex justify-end gap-2">
        <button 
          class="px-3 py-1.5 text-xs font-mono text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
          onclick={handleCancel}
        >
          {cancelText}
        </button>
        <button 
          class="px-3 py-1.5 text-xs font-mono rounded transition-colors {danger ? 'bg-[#dc382d] text-white hover:bg-[#e85d54]' : 'bg-[#1a1a1a] text-white hover:bg-[#333]'}"
          onclick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
