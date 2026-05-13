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
    class?: string;
    emptyText?: string;
    formatValue?: (value: number) => string;
  }

  let {
    series,
    height = 72,
    stroke = 'var(--color-chart-ops)',
    strokeWidth = 1.5,
    class: className = '',
    emptyText = 'collecting samples...',
    formatValue,
  }: Props = $props();

  const viewWidth = 100;
  const viewHeight = 40;
  const padTop = 3;
  const padBottom = 2;
  const plotHeight = viewHeight - padTop - padBottom;

  const gradientId = `spark-grad-${Math.random().toString(36).slice(2, 9)}`;
  const glowId = `spark-glow-${Math.random().toString(36).slice(2, 9)}`;

  let chartData = $derived.by(() => {
    const points = series.filter((point) => Number.isFinite(point.value));
    if (points.length === 0) {
      return { count: 0, linePath: '', areaPath: '', lastX: 0, lastY: 0, min: 0, max: 0, last: 0 };
    }

    const values = points.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const last = values[values.length - 1];
    if (min === max) {
      const pad = Math.max(Math.abs(min) * 0.1, 0.5);
      min -= pad;
      max += pad;
    }

    const step = points.length === 1 ? 0 : viewWidth / (points.length - 1);
    const coords = points.map((point, index) => {
      const x = index * step;
      const ratio = (point.value - min) / (max - min);
      const y = padTop + (1 - ratio) * plotHeight;
      return { x, y };
    });

    const linePath = coords
      .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
      .join(' ');

    const areaPath =
      coords.length > 1
        ? `${linePath} L${viewWidth},${viewHeight} L0,${viewHeight} Z`
        : '';
    const lastCoord = coords[coords.length - 1];

    return {
      count: points.length,
      linePath,
      areaPath,
      lastX: lastCoord.x,
      lastY: lastCoord.y,
      min,
      max,
      last,
    };
  });

  function format(value: number): string {
    if (formatValue) return formatValue(value);
    if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2);
  }
</script>

<div class={`sparkline-wrap w-full ${className}`} style={`height:${height}px`}>
  {#if chartData.count === 0}
    <div class="sparkline-empty">{emptyText}</div>
  {:else}
    <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="none" class="sparkline-svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={stroke} stop-opacity="0.28" />
          <stop offset="60%" stop-color={stroke} stop-opacity="0.08" />
          <stop offset="100%" stop-color={stroke} stop-opacity="0" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <line x1="0" y1={padTop + plotHeight * 0.25} x2={viewWidth} y2={padTop + plotHeight * 0.25} class="sparkline-grid" />
      <line x1="0" y1={padTop + plotHeight * 0.5} x2={viewWidth} y2={padTop + plotHeight * 0.5} class="sparkline-grid" />
      <line x1="0" y1={padTop + plotHeight * 0.75} x2={viewWidth} y2={padTop + plotHeight * 0.75} class="sparkline-grid" />

      {#if chartData.areaPath}
        <path d={chartData.areaPath} fill={`url(#${gradientId})`}></path>
      {/if}
      <path
        d={chartData.linePath}
        fill="none"
        stroke={stroke}
        stroke-width={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
        filter={`url(#${glowId})`}
        vector-effect="non-scaling-stroke"
      ></path>
      <circle cx={chartData.lastX} cy={chartData.lastY} r="2.2" fill={stroke} class="sparkline-point-halo" vector-effect="non-scaling-stroke"></circle>
      <circle cx={chartData.lastX} cy={chartData.lastY} r="1.1" fill="#fff" stroke={stroke} stroke-width="0.9" vector-effect="non-scaling-stroke"></circle>
    </svg>

    <div class="sparkline-meta">
      <span class="sparkline-meta-pill" title="min">min {format(chartData.min)}</span>
      <span class="sparkline-meta-pill" title="max">max {format(chartData.max)}</span>
    </div>
  {/if}
</div>

<style>
  .sparkline-wrap {
    position: relative;
    border-radius: 8px;
    border: 0.5px solid var(--color-glass-border-subtle, rgba(0, 0, 0, 0.06));
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.25) 100%);
    overflow: hidden;
  }

  .sparkline-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .sparkline-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .sparkline-grid {
    stroke: rgba(0, 0, 0, 0.05);
    stroke-width: 0.4;
    stroke-dasharray: 1.2 1.6;
    vector-effect: non-scaling-stroke;
  }

  .sparkline-point-halo {
    opacity: 0.22;
  }

  .sparkline-meta {
    position: absolute;
    top: 4px;
    right: 6px;
    display: flex;
    gap: 4px;
    pointer-events: none;
  }

  .sparkline-meta-pill {
    font-size: 9px;
    line-height: 1;
    padding: 2px 5px;
    border-radius: 999px;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.7);
    border: 0.5px solid var(--color-glass-border-subtle, rgba(0, 0, 0, 0.05));
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }
</style>
