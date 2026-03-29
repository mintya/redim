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
      case 'success': return 'text-[#28c840]';
      case 'error': return 'text-[#dc382d]';
      default: return 'text-[#1a1a1a]';
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
    <div class="bg-[#f8f8f8] border border-[#d4d4d4] rounded w-full max-w-sm shadow-lg">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[#d4d4d4] flex items-center gap-2">
        <span class="text-xs {getTypeColor()}">{getIcon()}</span>
        <span class="text-xs text-[#1a1a1a] font-mono">{title}</span>
      </div>
      
      <!-- Content -->
      <div class="px-4 py-4">
        <p class="text-sm text-[#1a1a1a] font-mono">{message}</p>
      </div>
      
      <!-- Actions -->
      <div class="px-4 py-3 border-t border-[#d4d4d4] flex justify-end">
        <button 
          class="px-4 py-1.5 text-xs font-mono bg-[#1a1a1a] text-white rounded hover:bg-[#333] transition-colors"
          onclick={handleClose}
        >
          ok
        </button>
      </div>
    </div>
  </div>
{/if}
