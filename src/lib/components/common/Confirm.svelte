<script lang="ts">
  import Button from './Button.svelte';

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
    if (e.target === e.currentTarget) handleCancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
    else if (e.key === 'Enter') handleConfirm();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 flex items-center justify-center z-50 glass-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <div class="ui-panel w-full max-w-sm shadow-[var(--shadow-glass-lg)]">
      <div class="ui-panel-header">
        <span class="ui-title">{title}</span>
      </div>

      <div class="px-3 py-3">
        <p class="text-xs text-[var(--color-text-primary)]">{message}</p>
      </div>

      <div class="px-3 py-2 border-t border-[var(--color-border)] flex justify-end gap-2">
        <Button variant="ghost" size="sm" onclick={handleCancel}>{cancelText}</Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" onclick={handleConfirm}>{confirmText}</Button>
      </div>
    </div>
  </div>
{/if}
