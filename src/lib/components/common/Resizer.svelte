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
  class="relative w-3 -mx-1.5 cursor-col-resize flex-shrink-0"
  onmousedown={handleMouseDown}
>
  <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px {isDragging ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-divider)]'}"></div>
</div>

{#if isDragging}
  <div
    class="fixed top-0 bottom-0 w-px bg-[var(--color-accent)]/60 z-50 pointer-events-none"
    style="left: {guideLineX}px"
  ></div>
{/if}
