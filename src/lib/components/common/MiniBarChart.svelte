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

<div class={`mini-bar-wrap ${className}`}>
  {#if items.length === 0}
    <div class="mini-bar-empty">{emptyText}</div>
  {:else}
    {#each items as item}
      <div class="mini-bar-row">
        <span class="mini-bar-label">{item.label}</span>
        <div class="mini-bar-track">
          <div
            class="mini-bar-fill"
            style={`width:${widthPercent(item.value)}%;--bar-color:${barColor};`}
          ></div>
        </div>
        <span class="mini-bar-value">{item.displayValue ?? item.value}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .mini-bar-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mini-bar-empty {
    height: 118px;
    border-radius: 8px;
    border: 0.5px solid var(--color-glass-border-subtle, rgba(0, 0, 0, 0.06));
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.25) 100%);
    color: var(--color-text-muted);
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mini-bar-row {
    display: grid;
    grid-template-columns: 2.4rem 1fr auto;
    gap: 8px;
    align-items: center;
  }

  .mini-bar-label {
    font-size: 10px;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .mini-bar-track {
    position: relative;
    height: 6px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }

  .mini-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--bar-color) 65%, transparent) 0%,
      var(--bar-color) 100%
    );
    box-shadow: 0 0 0 0.5px color-mix(in srgb, var(--bar-color) 35%, transparent) inset;
    transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .mini-bar-value {
    font-size: 10px;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
</style>
