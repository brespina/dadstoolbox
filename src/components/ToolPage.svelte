<script lang="ts">
  // The interactive part of every Tool page. The shared Batch logic holds the state;
  // this only shows it and passes on what the visitor does.
  import { onMount, type Component } from 'svelte';
  import { text } from '../text';
  import { createSession, type ItemStatus, type SessionState } from '../tools/batch';
  import { toolAt } from '../tools/registry';
  import type { ToolRun } from '../tools/types';
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
  const getRun = () => (runPromise ??= loadRun().then((module) => module.run));

  const session = createSession(tool, async (file, options) => (await getRun())(file, options));

  let options = $state(structuredClone(tool.defaultOptions));
  let state: SessionState = $state.raw(session.state());
  let announcement = $state('');
  let hydrated = $state(false);

  const statusText = (status: ItemStatus) => text.tool.status[status];
  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key]));

  onMount(() => {
    hydrated = true;
    // Load the Tool's `run` with the page, so pressing start doesn't wait.
    getRun().catch((error: unknown) => console.error('Could not load the Tool', error));

    const lastStatus = new Map<number, ItemStatus>();
    return session.subscribe((next) => {
      state = next;
      // One polite announcement per row status change.
      for (const item of next.batches.flatMap((batch) => batch.items)) {
        const before = lastStatus.get(item.id);
        lastStatus.set(item.id, item.status);
        if (before === undefined || before === item.status) continue;
        const status =
          item.status === 'failed'
            ? `${statusText('failed')}. ${item.reason}`
            : statusText(item.status);
        announcement = fill(text.tool.announcement, { name: item.name, status });
      }
    });
  });

  function chose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    session.add(input.files ?? []);
    // Clear the picker so choosing the same file again still counts.
    input.value = '';
  }

  const save = (files: SavableFile[]) =>
    saveFiles(files).catch((error: unknown) => console.error('Could not save', error));

  let newest = $derived(state.batches[0]);
  let saveAllFiles = $derived(newest ? session.saveAllFiles() : []);
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
      onchange={chose}
    />
    {fill(text.tool.choose, { noun: tool.noun.many })}
  </label>

  {#if state.waiting.length > 0}
    <section aria-labelledby="waiting-heading">
      <h2 id="waiting-heading">{text.tool.waitingHeading}</h2>
      <ul class="rows">
        {#each state.waiting as file (file.id)}
          <li class="row">
            <div class="row-text">
              <span class="file-name">{file.name}</span>
              <span class="muted">{formatSize(file.size)} · {statusText(file.status)}</span>
            </div>
            <button
              type="button"
              class="small-button"
              aria-label={fill(text.tool.removeLabel, { name: file.name })}
              onclick={() => session.remove(file.id)}>{text.tool.remove}</button
            >
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <button
    type="button"
    class="big-button start"
    disabled={!hydrated || state.waiting.length === 0 || state.working}
    onclick={() => session.start($state.snapshot(options))}>{tool.startButton}</button
  >

  {#if newest?.progress}
    <div class="progress">
      <progress class="moving" value={newest.progress.current - 1} max={newest.progress.total}
      ></progress>
      <p class="moving">{fill(text.tool.progress, newest.progress)}</p>
      <p class="still">{text.tool.working}</p>
    </div>
  {:else if newest}
    <p class="all-done">{tool.allDone}</p>
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
                {statusText(item.status)}{item.status === 'failed' ? `. ${item.reason}` : ''}
              </span>
            </div>
            {#if item.results.length > 0}
              <ul class="rows">
                {#each item.results as result (result.id)}
                  <li class="row">
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

  <div class="visually-hidden" aria-live="polite">{announcement}</div>
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
