<script lang="ts">
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
    class="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div class="bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-2xl w-full {sizeClasses[size]} mx-4 shadow-lg">
      {#if title}
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-macos-border)]">
          <span class="font-mono text-base text-[var(--color-macos-text)] font-semibold">{title}</span>
          <button 
            onclick={handleClose}
            class="text-[var(--color-macos-text-tertiary)] hover:text-[var(--color-macos-text)] transition-colors p-1 rounded-full hover:bg-[#f5f5f7]"
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
