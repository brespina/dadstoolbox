<script lang="ts">
  // One video's Start and End, on its Ready row: a preview to pause where you want, and
  // a button for each that takes the time the preview is at.
  import { fillText as fill } from '../../text';
  import { tool, type Options } from './declaration';
  import { formatTime } from './time';

  let {
    file,
    options,
    change,
  }: { file: File; options: Options; change: (values: Partial<Options>) => void } = $props();

  const notes = tool.notes as Record<string, string>;
  let video: HTMLVideoElement | undefined = $state();
  // Unknown until the preview has read the video.
  let duration: number | null = $state(null);

  const url = $derived(URL.createObjectURL(file));
  $effect(() => {
    const made = url;
    return () => URL.revokeObjectURL(made);
  });

  const now = () => video?.currentTime ?? 0;
  const end = $derived(options.end ?? duration);
  const length = $derived(end === null ? null : end - options.start);

  function setStart() {
    // End is set too, so a Start at the very end counts as End not after Start.
    change({ start: now(), end: options.end ?? duration });
  }
</script>

<div class="trim">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={video}
    src={url}
    controls
    playsinline
    preload="metadata"
    aria-label={fill(notes.previewLabel!, { name: file.name })}
    onloadedmetadata={() => {
      if (video && Number.isFinite(video.duration)) duration = video.duration;
    }}
  ></video>
  <p class="how-to">{notes.howTo}</p>
  <div class="mark">
    <span>{fill(notes.start!, { time: formatTime(options.start) })}</span>
    <button
      type="button"
      class="small-button"
      aria-label={fill(notes.setStartLabel!, { name: file.name })}
      onclick={setStart}>{notes.setStart}</button
    >
  </div>
  <div class="mark">
    <span>
      {end === null ? notes.toTheEnd : fill(notes.end!, { time: formatTime(end) })}
    </span>
    <button
      type="button"
      class="small-button"
      aria-label={fill(notes.setEndLabel!, { name: file.name })}
      onclick={() => change({ end: now() })}>{notes.setEnd}</button
    >
  </div>
  {#if length !== null && length > 0}
    <p class="length">{fill(notes.length!, { time: formatTime(length) })}</p>
  {/if}
</div>

<style>
  .trim {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  video {
    width: 100%;
    max-height: 50vh;
    border-radius: 0.5rem;
    background: #000;
  }

  .how-to,
  .length {
    margin: 0;
  }

  .length {
    font-weight: 600;
  }

  .mark {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }

  /* At least 44 x 44 px to tap, like the shared page's small buttons. */
  .small-button {
    min-height: 2.75rem;
    min-width: 2.75rem;
    padding: 0.25rem 1rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--action);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
