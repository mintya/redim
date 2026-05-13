<script lang="ts">
  import { onDestroy } from 'svelte';

  interface Props {
    onresize: (width: number) => void;
  }

  let { onresize }: Props = $props();

  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;

  let resizerEl = $state<HTMLDivElement | null>(null);
  let isDragging = $state(false);
  let startX = $state(0);
  let startWidth = $state(0);
  let rafId = $state<number | null>(null);
  let pendingWidth = $state<number | null>(null);

  function clampWidth(width: number): number {
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
  }

  function flushResize() {
    if (pendingWidth === null) return;
    onresize(pendingWidth);
    pendingWidth = null;
  }

  function queueResize(width: number) {
    pendingWidth = clampWidth(width);
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      flushResize();
    });
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = resizerEl?.previousElementSibling as HTMLElement | null;
    if (!target) return;

    isDragging = true;
    startX = e.clientX;
    startWidth = target.getBoundingClientRect().width;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    queueResize(startWidth + diff);
  }

  function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    flushResize();

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  onDestroy(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={resizerEl}
  class="relative w-3 -mx-1.5 cursor-col-resize flex-shrink-0"
  onmousedown={handleMouseDown}
>
  <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px {isDragging ? 'bg-[var(--color-accent)]' : 'bg-white/30'}"></div>
</div>
