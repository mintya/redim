<script lang="ts">
  interface Props {
    onresize: (width: number) => void;
  }

  let { onresize }: Props = $props();

  let isDragging = $state(false);
  let startX = $state(0);
  let startWidth = $state(0);
  let guideLineX = $state(0);

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    startX = e.clientX;
    guideLineX = e.clientX;
    const target = (e.target as HTMLElement).parentElement?.previousElementSibling;
    startWidth = target?.getBoundingClientRect().width || 288;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    guideLineX = e.clientX;
    const diff = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(600, startWidth + diff));
    onresize(newWidth);
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="w-1 bg-[var(--color-border-divider)] hover:bg-[var(--color-accent)] cursor-col-resize transition-colors flex-shrink-0 {isDragging ? 'bg-[var(--color-accent)]' : ''}"
  onmousedown={handleMouseDown}
></div>

{#if isDragging}
  <div 
    class="fixed top-0 bottom-0 w-0.5 bg-[var(--color-accent)] opacity-50 z-50 pointer-events-none"
    style="left: {guideLineX}px"
  ></div>
{/if}
