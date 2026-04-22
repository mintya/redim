<script lang="ts">
  interface BarItem {
    label: string;
    value: number;
    displayValue?: string;
  }

  interface Props {
    items: BarItem[];
    class?: string;
    emptyText?: string;
    barColor?: string;
  }

  let {
    items,
    class: className = '',
    emptyText = 'no data',
    barColor = 'var(--color-type-list)',
  }: Props = $props();

  let maxValue = $derived.by(() => {
    if (items.length === 0) return 1;
    const values = items.map((item) => item.value).filter((value) => Number.isFinite(value));
    const max = Math.max(...values, 0);
    return max <= 0 ? 1 : max;
  });

  function widthPercent(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(100, (value / maxValue) * 100);
  }
</script>

<div class={`space-y-2 ${className}`}>
  {#if items.length === 0}
    <div
      class="h-[118px] rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[10px] text-[var(--color-text-muted)] flex items-center justify-center"
    >
      {emptyText}
    </div>
  {:else}
    {#each items as item}
      <div class="grid grid-cols-[2.3rem_1fr_auto] gap-2 items-center">
        <span class="text-[10px] text-[var(--color-text-muted)]">{item.label}</span>
        <div class="h-2 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] overflow-hidden">
          <div
            class="h-full rounded-full"
            style={`width:${widthPercent(item.value)}%;background:${barColor};`}
          ></div>
        </div>
        <span class="text-[10px] text-[var(--color-text-secondary)] tabular-nums">{item.displayValue ?? item.value}</span>
      </div>
    {/each}
  {/if}
</div>
