<script lang="ts">
  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md';
    disabled?: boolean;
    onclick?: () => void;
    children: any;
  }

  let { 
    variant = 'secondary', 
    size = 'md', 
    disabled = false, 
    onclick,
    children 
  }: Props = $props();

  const variants = {
    primary: 'bg-[var(--color-accent)] text-white shadow-[var(--shadow-button-inset)] hover:bg-[var(--color-accent-hover)]',
    secondary: 'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]',
    ghost: 'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
  };
</script>

<button
  {disabled}
  {onclick}
  class="font-sans rounded-md transition-all duration-200 border {variants[variant]} {sizes[size]} disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 focus:shadow-[var(--shadow-focus)] focus:outline-none"
>
  {@render children()}
</button>
