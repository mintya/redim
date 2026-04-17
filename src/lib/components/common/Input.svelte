<script lang="ts">
  interface Props {
    type?: 'text' | 'password' | 'number';
    value: string | number | undefined;
    placeholder?: string;
    disabled?: boolean;
    oninput?: (value: string) => void;
    onblur?: () => void;
  }

  let { 
    type = 'text', 
    value = $bindable(), 
    placeholder = '', 
    disabled = false,
    oninput,
    onblur
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = type === 'number' ? Number(target.value) : target.value;
    oninput?.(String(value));
  }
</script>

<input
  {type}
  {value}
  {placeholder}
  {disabled}
  oninput={handleInput}
  onblur={onblur}
  class="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] font-sans text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-subtle)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
/>
