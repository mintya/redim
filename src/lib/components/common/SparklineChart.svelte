<script lang="ts">
  interface SeriesPoint {
    ts: number;
    value: number;
  }

  interface Props {
    series: SeriesPoint[];
    height?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    areaOpacity?: number;
    pointRadius?: number;
    pointOpacity?: number;
    class?: string;
    emptyText?: string;
  }

  let {
    series,
    height = 66,
    stroke = 'var(--color-type-list)',
    strokeWidth = 1.15,
    strokeOpacity = 0.78,
    areaOpacity = 0.06,
    pointRadius = 1.4,
    pointOpacity = 0.86,
    class: className = '',
    emptyText = 'collecting samples...',
  }: Props = $props();

  const viewWidth = 100;
  const viewHeight = 36;

  let chartData = $derived.by(() => {
    const points = series.filter((point) => Number.isFinite(point.value));
    if (points.length === 0) {
      return { count: 0, linePath: '', areaPath: '', lastX: 0, lastY: 0 };
    }

    const values = points.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }

    const step = points.length === 1 ? 0 : viewWidth / (points.length - 1);
    const coords = points.map((point, index) => {
      const x = index * step;
      const ratio = (point.value - min) / (max - min);
      const y = viewHeight - ratio * viewHeight;
      return { x, y };
    });

    const linePath = coords
      .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
      .join(' ');

    const areaPath =
      coords.length > 1 ? `${linePath} L${viewWidth},${viewHeight} L0,${viewHeight} Z` : '';
    const last = coords[coords.length - 1];

    return {
      count: points.length,
      linePath,
      areaPath,
      lastX: last.x,
      lastY: last.y,
    };
  });
</script>

<div class={`w-full ${className}`}>
  {#if chartData.count === 0}
    <div
      class="h-[66px] rounded-[6px] border border-[var(--color-border-divider)] bg-[var(--color-bg-elevated)] text-[10px] text-[var(--color-text-muted)] flex items-center justify-center"
    >
      {emptyText}
    </div>
  {:else}
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="none"
      class="w-full rounded-[6px] border border-[var(--color-border-divider)] bg-[var(--color-bg-elevated)]"
      style={`height:${height}px`}
    >
      {#if chartData.areaPath}
        <path d={chartData.areaPath} fill={stroke} opacity={areaOpacity}></path>
      {/if}
      <path
        d={chartData.linePath}
        fill="none"
        stroke={stroke}
        stroke-width={strokeWidth}
        stroke-opacity={strokeOpacity}
        stroke-linecap="round"
        stroke-linejoin="round"
      ></path>
      <circle cx={chartData.lastX} cy={chartData.lastY} r={pointRadius} fill={stroke} opacity={pointOpacity}></circle>
    </svg>
  {/if}
</div>
