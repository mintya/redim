<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    onclose?: () => void;
    children: any;
  }

  let { open = $bindable(), title = '', onclose, children }: Props = $props();

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
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[#f8f8f8] border border-[#d4d4d4] rounded-md w-full max-w-md mx-4 shadow-lg">
      {#if title}
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#d4d4d4]">
          <span class="font-mono text-sm text-[#1a1a1a]">{title}</span>
          <button 
            onclick={handleClose}
            class="text-[#9a9a9a] hover:text-[#1a1a1a] transition-colors"
          >
            ✕
          </button>
        </div>
      {/if}
      <div class="p-4">
        {@render children()}
      </div>
    </div>
  </div>
{/if}
