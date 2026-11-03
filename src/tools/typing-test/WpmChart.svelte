<script lang="ts">
  // The speed through a finished test, drawn as two lines in plain SVG: the words per
  // minute (solid) and the raw words per minute (dashed), so colour is not the only
  // difference between them. Colours come from the Site's tokens, so both themes work.
  // The same numbers are in a table below, which is the text alternative in full.
  import { fillText } from '../../text';
  import { tool } from './declaration';
  import type { Sample } from './samples';

  const { samples }: { samples: Sample[] } = $props();
  const { notes } = tool;
  const id = $props.id();

  // The drawing is 400 wide, a bit more than a phone's width, so its text keeps a
  // readable size when it shrinks to fit.
  const width = 400;
  const height = 230;
  const left = 40;
  const right = 12;
  const top = 12;
  const bottom = 40;

  const total = $derived(samples.at(-1)?.second ?? 0);

  /** The top of the chart: the highest speed rounded up to a multiple of 20. */
  const ceiling = $derived(
    Math.max(20, Math.ceil(Math.max(...samples.map((s) => Math.max(s.wpm, s.raw))) / 20) * 20),
  );

  /** The gap between marks along the bottom, so there are about six of them. */
  const step = $derived([1, 2, 5, 10, 15, 30, 60, 120].find((n) => total / n <= 6) ?? 300);
  const marks = $derived(Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step));

  const x = (second: number) => left + (second / total) * (width - left - right);
  const y = (value: number) => top + (1 - value / ceiling) * (height - top - bottom);
  const line = (values: number[]) =>
    samples.map((s, i) => `${x(s.second).toFixed(1)},${y(values[i]!).toFixed(1)}`).join(' ');

  const summary = $derived.by(() => {
    const peak = samples.reduce((best, s) => (s.wpm > best.wpm ? s : best), samples[0]!);
    return fillText(notes.chartSummary, {
      seconds: Math.round(total * 10) / 10,
      first: samples[0]!.wpm,
      peak: peak.wpm,
      peakSecond: Math.round(peak.second * 10) / 10,
      last: samples.at(-1)!.wpm,
      rawLast: samples.at(-1)!.raw,
    });
  });
</script>

{#if samples.length < 2}
  <p class="short">{notes.chartTooShort}</p>
{:else}
  <figure class="chart">
    <figcaption>{notes.chartTitle}</figcaption>
    <ul class="legend">
      <li><span class="swatch wpm"></span>{notes.chartWpm}</li>
      <li><span class="swatch raw"></span>{notes.chartRaw}</li>
    </ul>
    <svg viewBox="0 0 {width} {height}" role="img" aria-labelledby="{id}-title {id}-desc">
      <title id="{id}-title">{notes.chartTitle}</title>
      <desc id="{id}-desc">{summary}</desc>
      {#each [0, ceiling / 2, ceiling] as tick (tick)}
        <line class="grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} />
        <text class="tick" x={left - 6} y={y(tick)} text-anchor="end" dominant-baseline="middle">
          {tick}
        </text>
      {/each}
      {#each marks as mark (mark)}
        <text class="tick" x={x(mark)} y={height - bottom + 16} text-anchor="middle">{mark}</text>
      {/each}
      <text class="axis" x={(left + width - right) / 2} y={height - 6} text-anchor="middle">
        {notes.chartSeconds}
      </text>
      <polyline class="raw" points={line(samples.map((s) => s.raw))} />
      <polyline class="wpm" points={line(samples.map((s) => s.wpm))} />
    </svg>
    <details>
      <summary>{notes.chartNumbers}</summary>
      <table>
        <caption class="visually-hidden">{notes.chartTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{notes.chartSecond}</th>
            <th scope="col">{notes.chartWpm}</th>
            <th scope="col">{notes.chartRaw}</th>
          </tr>
        </thead>
        <tbody>
          {#each samples as sample (sample.second)}
            <tr>
              <th scope="row">{Math.round(sample.second * 10) / 10}</th>
              <td>{sample.wpm}</td>
              <td>{sample.raw}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  </figure>
{/if}

<style>
  .chart {
    margin: 1.5rem 0 0;
    max-width: 28rem;
  }

  figcaption {
    font-weight: 600;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    margin: 0.25rem 0 0.5rem;
    padding: 0;
    list-style: none;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .swatch {
    width: 1.75rem;
    border-top: 3px solid var(--action);
  }

  .swatch.raw {
    border-top: 3px dashed var(--muted);
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }

  text {
    fill: var(--muted);
    font-family: var(--mono);
    font-size: 12px;
  }

  text.axis {
    font-family: inherit;
  }

  polyline {
    fill: none;
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .wpm {
    stroke: var(--action);
  }

  .raw {
    stroke: var(--muted);
    stroke-dasharray: 6 4;
  }

  details {
    margin-top: 0.5rem;
  }

  summary {
    min-height: 2.75rem;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.25rem 0.5rem;
    border-top: 1px solid var(--line);
    text-align: right;
  }

  thead th {
    color: var(--muted);
    font-weight: 600;
  }

  tbody th {
    font-weight: 400;
  }

  .short {
    margin: 1rem 0 0;
    color: var(--muted);
  }
</style>
