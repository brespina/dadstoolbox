<script lang="ts">
  // The interactive part of every Tool page. The shared Batch logic holds the state;
  // this only shows it and passes on what the visitor does.
  import { onDestroy, onMount, type Component } from 'svelte';
  import { fillText as fill, text } from '../text';
  import {
    createToolPage,
    type BatchItem,
    type ItemStatus,
    type ResultFile,
    type ToolPageState,
  } from '../tools/batch';
  import { toolAt } from '../tools/registry';
  import { wordsFor, type ToolRun } from '../tools/types';
  import { saveFiles, type SavableFile } from '../site/save';
  import { formatSize } from '../site/size';

  let { address }: { address: string } = $props();

  // Options components are small, so every page has them all and they render with the
  // page. Each Tool's `run` (and its library) loads only on its own page.
  const optionsComponents = import.meta.glob<{ default: Component<{ options: object }> }>(
    ['../tools/*/Options.svelte', '!../tools/_*/Options.svelte'],
    { eager: true },
  );
  const runModules = import.meta.glob<{ run: ToolRun<object> }>([
    '../tools/*/run.ts',
    '!../tools/_*/run.ts',
  ]);

  // The address never changes on a page, so reading it once is right.
  // svelte-ignore state_referenced_locally
  const tool = toolAt(address);
  const Options = optionsComponents[`../tools/${tool.address}/Options.svelte`]!.default;
  const loadRun = runModules[`../tools/${tool.address}/run.ts`]!;

  let runPromise: Promise<ToolRun<object>> | undefined;
  const getRun = () =>
    (runPromise ??= loadRun().then(
      (module) => module.run,
      (error: unknown) => {
        // Forget a failed load, so the next file tries again.
        runPromise = undefined;
        throw error;
      },
    ));

  const toolPage = createToolPage(tool, async (file, options) => (await getRun())(file, options));

  let options = $state(structuredClone(tool.defaultOptions));
  let state: ToolPageState = $state.raw(toolPage.state());
  // Each status change is added as its own line, so none is lost when the next comes fast.
  let announcements: { id: number; text: string }[] = $state([]);
  let hydrated = $state(false);

  /** "Done", or "Didn't work. <reason>". */
  const statusLine = (item: Pick<BatchItem, 'status' | 'reason'>) =>
    item.status === 'failed'
      ? fill(text.tool.failedLine, { reason: item.reason ?? text.tool.failedFallback })
      : text.tool.status[item.status];

  onMount(() => {
    hydrated = true;
    // Load the Tool's `run` with the page, so pressing start doesn't wait.
    getRun().catch((error: unknown) => console.error('Could not load the Tool', error));

    const lastStatus = new Map<number, ItemStatus>();
    let nextAnnouncement = 1;
    return toolPage.subscribe((next) => {
      state = next;
      // One polite announcement per row status change.
      for (const item of next.batches.flatMap((batch) => batch.items)) {
        const before = lastStatus.get(item.id);
        lastStatus.set(item.id, item.status);
        if (before === undefined || before === item.status) continue;
        const line = fill(text.tool.announcement, { name: item.name, status: statusLine(item) });
        announcements = [...announcements, { id: nextAnnouncement++, text: line }];
      }
    });
  });

  function onChoose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    toolPage.add(input.files ?? []);
    // Clear the picker so choosing the same file again still counts.
    input.value = '';
  }

  const save = (files: SavableFile[]) =>
    saveFiles(files).catch((error: unknown) => console.error('Could not save', error));

  let newest = $derived(state.batches[0]);
  let saveAllFiles = $derived(newest ? toolPage.saveAllFiles() : []);
  let anyChosen = $derived(state.waiting.length > 0 || state.batches.length > 0);
  // The start button follows the options, and has work when a file hasn't run with them.
  let words = $derived(wordsFor(tool, options));
  let hasWork = $derived(state && toolPage.hasWork($state.snapshot(options)));

  // One address per result picture, kept until the page closes, like the results.
  const thumbnails = new Map<number, string>();
  const thumbnail = (result: ResultFile) => {
    let url = thumbnails.get(result.id);
    if (!url) thumbnails.set(result.id, (url = URL.createObjectURL(result.blob)));
    return url;
  };
  onDestroy(() => thumbnails.forEach((url) => URL.revokeObjectURL(url)));
</script>

<div class="tool">
  <Options bind:options />

  <label class="big-button choose" class:disabled={!hydrated}>
    <input
      type="file"
      class="visually-hidden"
      multiple
      accept={tool.accept.join(',')}
      disabled={!hydrated}
      onchange={onChoose}
    />
    {fill(anyChosen ? text.tool.chooseMore : text.tool.choose, { noun: tool.noun.many })}
  </label>

  {#if state.waiting.length > 0}
    <section aria-labelledby="waiting-heading">
      <h2 id="waiting-heading">{text.tool.waitingHeading}</h2>
      <ul class="rows">
        {#each state.waiting as file (file.id)}
          <li class="row">
            <div class="row-text">
              <span class="file-name">{file.name}</span>
              <span class="muted">{formatSize(file.size)} · {statusLine(file)}</span>
            </div>
            <button
              type="button"
              class="small-button"
              aria-label={fill(text.tool.removeLabel, { name: file.name })}
              onclick={() => toolPage.remove(file.id)}>{text.tool.remove}</button
            >
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <button
    type="button"
    class="big-button start"
    disabled={!hydrated || !hasWork || state.working}
    onclick={() => toolPage.start($state.snapshot(options))}>{words.startButton}</button
  >

  {#if newest?.progress}
    <div class="progress">
      <progress class="moving" value={newest.progress.current - 1} max={newest.progress.total}
      ></progress>
      <p class="moving">{fill(text.tool.progress, newest.progress)}</p>
      <p class="still">{text.tool.working}</p>
    </div>
  {:else if saveAllFiles.length > 0}
    <p class="all-done">{newest!.allDone}</p>
  {/if}

  {#each state.batches as batch, index (batch.id)}
    <section class="batch" aria-labelledby={`batch-${batch.id}`}>
      <div class="batch-heading">
        <h2 id={`batch-${batch.id}`}>{batch.label}</h2>
        {#if index === 0 && saveAllFiles.length > 1}
          <button type="button" class="small-button" onclick={() => save(saveAllFiles)}
            >{text.tool.saveAll}</button
          >
        {/if}
      </div>
      <ul class="rows">
        {#each batch.items as item (item.id)}
          <li class="item">
            <div class="row-text">
              <span class="file-name">{item.name}</span>
              <span class:failed={item.status === 'failed'}>
                {statusLine(item)}
              </span>
            </div>
            {#if item.results.length > 0}
              <ul class="rows">
                {#each item.results as result (result.id)}
                  <li class="row">
                    {#if result.blob.type.startsWith('image/')}
                      <img class="thumbnail" src={thumbnail(result)} alt="" />
                    {/if}
                    <div class="row-text">
                      <span class="file-name">{result.name}</span>
                      <span class="muted">{formatSize(item.size)} → {formatSize(result.size)}</span>
                    </div>
                    <button
                      type="button"
                      class="small-button"
                      aria-label={fill(text.tool.saveLabel, { name: result.name })}
                      onclick={() => save([result])}>{text.tool.save}</button
                    >
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}

  <div class="visually-hidden" aria-live="polite">
    {#each announcements as announcement (announcement.id)}
      <p>{announcement.text}</p>
    {/each}
  </div>
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Choose and start: full width and at least 56 px tall. */
  .big-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 3.5rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--action);
    color: var(--action-text);
    font: inherit;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
  }

  .choose {
    background: var(--bg);
    color: var(--action);
  }

  .choose:focus-within {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .big-button:disabled,
  .big-button.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  /* At least 44 x 44 px to tap. */
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
    flex-shrink: 0;
  }

  h2 {
    margin: 0 0 0.5rem;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row,
  .item {
    border-top: 1px solid var(--line);
    padding: 0.5rem 0;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .item > .rows {
    margin-top: 0.5rem;
    padding-left: 1rem;
  }

  .thumbnail {
    width: 3rem;
    height: 3rem;
    border-radius: 0.375rem;
    object-fit: cover;
    background: var(--line);
    flex-shrink: 0;
  }

  .row-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .file-name {
    overflow-wrap: anywhere;
    font-weight: 600;
  }

  .failed {
    color: var(--problem);
  }

  .batch-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .progress progress {
    width: 100%;
    height: 1rem;
    accent-color: var(--action);
  }

  .progress p,
  .all-done {
    margin: 0;
  }

  /* Only the progress bar moves; with reduced motion it becomes a still "Working…". */
  .still {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .moving {
      display: none;
    }

    .still {
      display: block;
    }
  }
</style>
