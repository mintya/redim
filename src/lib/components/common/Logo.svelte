<script lang="ts">
  interface Props {
    size?: number;
  }

  let { size = 18 }: Props = $props();
</script>

<svg 
  width={size} 
  height={size} 
  viewBox="0 0 24 24" 
  fill="none" 
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- 红色大于号 -->
  <path 
    d="M6 7L12 12L6 17" 
    stroke="#DC382D" 
    stroke-width="2.5" 
    stroke-linecap="round" 
    stroke-linejoin="round"
  />
  <!-- 黑色下划线光标 -->
  <path 
    d="M14 17H20" 
    stroke="#1a1a1a" 
    stroke-width="3" 
    stroke-linecap="round"
  />
</svg>
