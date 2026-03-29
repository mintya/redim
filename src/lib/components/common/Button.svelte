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
    primary: 'bg-[#dc382d] text-white hover:bg-[#e85d54] border-[#dc382d]',
    secondary: 'bg-white text-[#1a1a1a] hover:bg-[#f0f0f0] border-[#d4d4d4]',
    ghost: 'bg-transparent text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] border-transparent',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };
</script>

<button
  {disabled}
  {onclick}
  class="font-mono rounded transition-colors border {variants[variant]} {sizes[size]} disabled:opacity-50 disabled:cursor-not-allowed"
>
  {@render children()}
</button>
