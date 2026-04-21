<script lang="ts">
  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    disabled?: boolean;
    onclick?: () => void;
    class?: string;
    children: any;
  }

  let {
    variant = 'secondary',
    size = 'md',
    disabled = false,
    onclick,
    class: className = '',
    children
  }: Props = $props();

  const variants = {
    primary: 'ui-btn-primary',
    secondary: '',
    ghost: 'ui-btn-ghost',
    danger: 'ui-btn-danger'
  };

  const sizes = {
    sm: 'ui-btn-sm',
    md: 'ui-btn-md',
  };
</script>

<button
  {disabled}
  {onclick}
  class="ui-btn {variants[variant]} {sizes[size]} {className}"
>
  {@render children()}
</button>
