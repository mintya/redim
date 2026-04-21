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
  class="w-full h-8 px-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[6px] text-[13px] text-[var(--color-text-primary)] font-sans placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[var(--shadow-input-focus)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
/>
