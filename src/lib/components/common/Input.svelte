<script lang="ts">
  interface Props {
    type?: 'text' | 'password' | 'number';
    value: string | number;
    placeholder?: string;
    disabled?: boolean;
    oninput?: (value: string) => void;
  }

  let { 
    type = 'text', 
    value = $bindable(), 
    placeholder = '', 
    disabled = false,
    oninput
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
  class="w-full px-2.5 py-1.5 bg-[#fafafa] border border-[#d4d4d4] rounded text-[#1a1a1a] font-mono text-sm placeholder:text-[#9a9a9a] focus:outline-none focus:border-[#dc382d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
/>
