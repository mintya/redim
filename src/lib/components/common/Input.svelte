<script lang="ts">
  interface Props {
    type?: 'text' | 'password' | 'number';
    value: string | number | undefined;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    oninput?: (value: string) => void;
    onblur?: () => void;
  }

  let {
    type = 'text',
    value = $bindable(),
    placeholder = '',
    disabled = false,
    class: className = '',
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
  class="ui-input {className}"
/>
