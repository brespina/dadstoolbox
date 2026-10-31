<script lang="ts">
  // The interactive part of every Tool page. The shared Batch logic holds the state;
  // this only shows it and passes on what the visitor does.
  import { onDestroy, onMount, tick, type Component } from 'svelte';
  import { fillText as fill, text } from '../text';
  import {
    createToolPage,
    type BatchItem,
    type ItemStatus,
    type ResultFile,
    type ToolPageState,
  } from '../tools/batch';
  import { toolAt } from '../tools/registry';
  import { wordsFor, type OptionsProps, type ReadyLine, type ReadyNote } from '../tools/types';
  import { fileTypeOf } from '../tools/file-type';
  import { runInWorker, type AnyRun } from '../tools/worker';
  import { saveFiles, type SavableFile } from '../site/save';
  import { formatSize } from '../site/size';
  import { browserCanRun } from '../site/features';
  import pageRuns from 'virtual:tool-runs/page';

  let { address }: { address: string } = $props();

  // Options components are small, so every page has them all and they render with the
  // page. Each Tool's `run` (and its library) loads only on its own page, or only in the
  // worker for a Tool marked worker.
  const optionsComponents = import.meta.glob<{ default: Component<OptionsProps<object>> }>(
    ['../tools/*/Options.svelte', '!../tools/_*/Options.svelte'],
    { eager: true },
  );
  // A Tool's editor for one chosen file's own options (`fileOptions`), on its Ready row,
  // such as Trim a video's Start and End. Few Tools have one, and it is small.
  type FileOptionsProps = {
    file: File;
    options: object;
    change: (values: object) => void;
  };
  const fileOptionsComponents = import.meta.glob<{ default: Component<FileOptionsProps> }>(
    ['../tools/*/FileOptions.svelte', '!../tools/_*/FileOptions.svelte'],
    { eager: true },
  );
  // A Tool's own lines for a Ready row, such as an estimated size. Few Tools have one.
  const readyModules = import.meta.glob<{ readyNote: ReadyNote }>([
    '../tools/*/ready.ts',
    '!../tools/_*/ready.ts',
  ]);

  // The address never changes on a page, so reading it once is right.
  // svelte-ignore state_referenced_locally
  const tool = toolAt(address);
  const Options = optionsComponents[`../tools/${tool.address}/Options.svelte`]!.default;
  // This page takes files, so its `run` does too. A worker Tool has none here.
  const loadRun = pageRuns[tool.address] as (() => Promise<{ run: AnyRun }>) | undefined;
  const loadReady = readyModules[`../tools/${tool.address}/ready.ts`];
  const FileOptions = fileOptionsComponents[`../tools/${tool.address}/FileOptions.svelte`]?.default;

  // A Tool marked worker runs there, and its `run` loads in the worker, not the page.
  // If the worker stops, the file it was on fails, and the next file starts a new one.
  const startWorker = () => {
    const worker = new Worker(new URL('../tools/run.worker.ts', import.meta.url), {
      type: 'module',
    });
    const died = new Promise<never>((_, reject) =>
      worker.addEventListener(
        'error',
        (event) => {
          worker.terminate();
          runPromise = undefined;
          reject(new Error(`The worker stopped: ${event.message}`));
        },
        { once: true },
      ),
    );
    // A worker that never stops leaves this unwatched.
    died.catch(() => {});
    return runInWorker(worker, tool.address, died);
  };

  let runPromise: Promise<AnyRun> | undefined;
  const getRun = () =>
    (runPromise ??= (tool.worker ? Promise.resolve({ run: startWorker() }) : loadRun!()).then(
      (module) => module.run,
      (error: unknown) => {
        // Forget a failed load, so the next file tries again.
        runPromise = undefined;
        throw error;
      },
    ));

  const toolPage = createToolPage(tool, async (input: File | File[], options: object, context) =>
    (await getRun())(input, options, context),
  );

  let options = $state(structuredClone(tool.defaultOptions));
  let state: ToolPageState = $state.raw(toolPage.state());
  // Each status change is added as its own line, so none is lost when the next comes fast.
  let announcements: { id: number; text: string }[] = $state([]);
  let hydrated = $state(false);
  // Whether this browser has the features the Tool needs. Checked once the page runs.
  let supported = $state(true);
  let canChoose = $derived(hydrated && supported);

  /** "Done", "Working… 40%", or "Didn't work. <reason>". */
  const statusLine = (item: Pick<BatchItem, 'status' | 'reason' | 'percent'>) => {
    if (item.status === 'failed')
      return fill(text.tool.failedLine, { reason: item.reason ?? text.tool.failedFallback });
    if (item.status === 'working' && item.percent !== undefined)
      return fill(text.tool.workingPercent, { percent: item.percent });
    return text.tool.status[item.status];
  };

  // How often a working row's percent is announced: at 25%, 50% and 75%, not every tick.
  const announceEvery = 25;

  onMount(() => {
    hydrated = true;
    supported = browserCanRun(tool.needs);
    if (!supported) return;
    // Load the Tool's `run` with the page, so pressing start doesn't wait.
    getRun().catch((error: unknown) => console.error('Could not load the Tool', error));

    const lastStatus = new Map<number, ItemStatus>();
    const lastStep = new Map<number, number>();
    let nextAnnouncement = 1;
    const announce = (item: BatchItem) => {
      const line = fill(text.tool.announcement, { name: item.name, status: statusLine(item) });
      announcements = [...announcements, { id: nextAnnouncement++, text: line }];
    };
    return toolPage.subscribe((next) => {
      state = next;
      for (const item of next.batches.flatMap((batch) => batch.items)) {
        // One polite announcement per row status change.
        const before = lastStatus.get(item.id);
        lastStatus.set(item.id, item.status);
        if (before !== undefined && before !== item.status) announce(item);
        // And a few for a working row's percent, below 100 (Done comes next).
        if (item.status !== 'working' || item.percent === undefined || item.percent >= 100)
          continue;
        const step = Math.floor(item.percent / announceEvery);
        if (step > (lastStep.get(item.id) ?? 0)) announce(item);
        lastStep.set(item.id, Math.max(step, lastStep.get(item.id) ?? 0));
      }
    });
  });

  function onChoose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    toolPage.add(input.files ?? []);
    // Clear the picker so choosing the same file again still counts.
    input.value = '';
  }

  let waitingList: HTMLElement | undefined = $state();

  // The Tool's own Ready row lines, by file, for the options as they are now.
  let readyLines: Map<number, ReadyLine[]> = $state.raw(new Map());
  $effect(() => {
    if (!loadReady) return;
    const files = state.waiting;
    const chosen = $state.snapshot(options);
    let current = true;
    loadReady()
      .then(({ readyNote }) =>
        Promise.all(files.map(async (f) => [f.id, await readyNote(f.file, chosen)] as const)),
      )
      .then((lines) => {
        if (current) readyLines = new Map(lines);
      })
      .catch((error: unknown) => console.error('Could not make the Ready notes', error));
    return () => {
      current = false;
    };
  });

  /** Moves a file, keeping keyboard focus on its buttons as it goes. */
  async function move(id: number, by: -1 | 1) {
    toolPage.move(id, by);
    await tick();
    const buttons = [-1, 1].map((d) =>
      waitingList?.querySelector<HTMLButtonElement>(`[data-move="${id}:${d}"]`),
    );
    const [same, other] = by === -1 ? buttons : buttons.reverse();
    (same?.disabled ? other : same)?.focus();
  }

  const save = (files: SavableFile[]) =>
    saveFiles(files).catch((error: unknown) => console.error('Could not save', error));

  let newest = $derived(state.batches[0]);
  let saveAllFiles = $derived(newest ? toolPage.saveAllFiles() : []);
  let anyChosen = $derived(state.waiting.length > 0 || state.batches.length > 0);
  // The start button follows the options, and has work when a file hasn't run with them.
  let words = $derived(wordsFor(tool, options));
  // What the Options are told about the chosen files, such as to hide a type they already are.
  let fileTypes = $derived(state.waiting.map(({ file }) => fileTypeOf(file)));
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
  <Options bind:options {fileTypes} />

  {#if !supported}
    <p class="unsupported">{text.tool.unsupported}</p>
  {/if}

  <label class="big-button choose" class:disabled={!canChoose}>
    <input
      type="file"
      class="visually-hidden"
      multiple
      accept={tool.accept.join(',')}
      disabled={!canChoose}
      onchange={onChoose}
    />
    {fill(anyChosen ? text.tool.chooseMore : text.tool.choose, { noun: tool.noun.many })}
  </label>

  {#if state.waiting.length > 0}
    <section aria-labelledby="waiting-heading">
      <h2 id="waiting-heading">{text.tool.waitingHeading}</h2>
      <ul class="rows" bind:this={waitingList}>
        {#each state.waiting as file, index (file.id)}
          {@const problem = tool.optionsProblem({
            ...$state.snapshot(options),
            ...file.fileOptions,
          })}
          <li class="row" class:has-editor={FileOptions}>
            <div class="row-text">
              <span class="file-name">{file.name}</span>
              <span class="muted">{formatSize(file.size)} · {statusLine(file)}</span>
              {#if problem}
                <span class="warning">{problem}</span>
              {/if}
              {#each readyLines.get(file.id) ?? [] as line (line.text)}
                <span class:warning={line.warning}>{line.text}</span>
              {/each}
              {#if file.large}
                <span class="warning">{tool.largeFileNote}</span>
              {/if}
            </div>
            <div class="row-buttons">
              {#if tool.input === 'together'}
                <button
                  type="button"
                  class="small-button move"
                  data-move={`${file.id}:-1`}
                  aria-label={fill(text.tool.moveUpLabel, { name: file.name })}
                  disabled={index === 0}
                  onclick={() => move(file.id, -1)}>{text.tool.moveUp}</button
                >
                <button
                  type="button"
                  class="small-button move"
                  data-move={`${file.id}:1`}
                  aria-label={fill(text.tool.moveDownLabel, { name: file.name })}
                  disabled={index === state.waiting.length - 1}
                  onclick={() => move(file.id, 1)}>{text.tool.moveDown}</button
                >
              {/if}
              <button
                type="button"
                class="small-button"
                aria-label={fill(text.tool.removeLabel, { name: file.name })}
                onclick={() => toolPage.remove(file.id)}>{text.tool.remove}</button
              >
            </div>
            {#if FileOptions}
              <div class="file-options">
                <FileOptions
                  file={file.file}
                  options={file.fileOptions}
                  change={(values) => toolPage.setFileOptions(file.id, values)}
                />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <button
    type="button"
    class="big-button start"
    disabled={!canChoose || !hasWork || state.working}
    onclick={() => toolPage.start($state.snapshot(options))}>{words.startButton}</button
  >

  {#if newest?.progress}
    <div class="progress">
      <progress class="moving" value={newest.progress.current - 1} max={newest.progress.total}
      ></progress>
      {#if newest.gettingReady}
        <p>{text.tool.gettingReady}</p>
      {:else}
        <p class="moving">{fill(text.tool.progress, newest.progress)}</p>
        <p class="still">{text.tool.working}</p>
      {/if}
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

  .small-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .move {
    padding: 0.25rem;
  }

  .row-buttons {
    display: flex;
    gap: 0.5rem;
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

  /* A Tool's editor for the file goes full width under its name and buttons. */
  .row.has-editor {
    flex-wrap: wrap;
  }

  .file-options {
    flex-basis: 100%;
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

  .failed,
  .warning {
    color: var(--problem);
  }

  .unsupported {
    margin: 0;
    font-weight: 600;
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
