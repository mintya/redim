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
    primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-light)] border-[var(--color-accent)] shadow-sm',
    secondary: 'bg-[var(--color-macos-surface)] text-[var(--color-macos-text)] hover:bg-[var(--color-surface-hover)] border-[var(--color-macos-border)] shadow-sm',
    ghost: 'bg-transparent text-[var(--color-macos-text-secondary)] hover:text-[var(--color-macos-text)] hover:bg-[var(--color-surface-hover)] border-transparent',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-base',
    md: 'px-4 py-2 text-base',
  };
</script>

<button
  {disabled}
  {onclick}
  class="font-mono rounded-lg transition-all duration-200 border {variants[variant]} {sizes[size]} disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
>
  {@render children()}
</button>
