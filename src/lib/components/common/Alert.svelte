<script lang="ts">
  import Button from './Button.svelte';
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
    if (e.target === e.currentTarget) handleClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter') handleClose();
  }

  function getTypeColor() {
    switch (type) {
      case 'success':
        return 'text-[var(--color-type-string)]';
      case 'error':
        return 'text-[var(--color-accent)]';
      default:
        return 'text-[var(--color-text-secondary)]';
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
  <div class="fixed inset-0 flex items-center justify-center z-50 glass-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <div class="ui-panel w-full max-w-sm shadow-[var(--shadow-glass-lg)]">
      <div class="ui-panel-header justify-start gap-2">
        <IconComponent class="w-4 h-4 {getTypeColor()}" />
        <span class="ui-title">{title}</span>
      </div>

      <div class="px-3 py-3">
        <p class="text-xs text-[var(--color-text-primary)]">{message}</p>
      </div>

      <div class="px-3 py-2 border-t border-[var(--color-border)] flex justify-end">
        <Button variant="primary" size="sm" onclick={handleClose}>ok</Button>
      </div>
    </div>
  </div>
{/if}
