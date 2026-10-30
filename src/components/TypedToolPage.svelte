<script lang="ts">
  // The interactive part of a Tool page where the person types instead of choosing
  // files (input mode "none"). No Choose or start button: the result follows the typing.
  import { onMount, type Component } from 'svelte';
  import { fillText as fill, text } from '../text';
  import { createTypedToolPage, type TypedToolPageState } from '../tools/typed';
  import { toolAt } from '../tools/registry';
  import type { ToolTextRun } from '../tools/types';
  import { saveFiles } from '../site/save';

  let { address }: { address: string } = $props();

  const optionsComponents = import.meta.glob<{ default: Component<{ options: object }> }>(
    ['../tools/*/Options.svelte', '!../tools/_*/Options.svelte'],
    { eager: true },
  );
  const runModules = import.meta.glob<{ run: ToolTextRun<object> }>([
    '../tools/*/run.ts',
    '!../tools/_*/run.ts',
  ]);

  // The address never changes on a page, so reading it once is right.
  // svelte-ignore state_referenced_locally
  const tool = toolAt(address);
  const Options = optionsComponents[`../tools/${tool.address}/Options.svelte`]!.default;
  const loadRun = runModules[`../tools/${tool.address}/run.ts`]!;

  let runPromise: Promise<ToolTextRun<object>> | undefined;
  const getRun = () =>
    (runPromise ??= loadRun().then(
      (module) => module.run,
      (error: unknown) => {
        // Forget a failed load, so the next keypress tries again.
        runPromise = undefined;
        throw error;
      },
    ));

  const toolPage = createTypedToolPage(tool, async (typed, options) =>
    (await getRun())(typed, options),
  );

  let options = $state(structuredClone(tool.defaultOptions));
  let state: TypedToolPageState = $state.raw(toolPage.state());
  let announcement = $state('');
  let hydrated = $state(false);
  let pictureUrl = $state<string | undefined>();

  onMount(() => {
    hydrated = true;
    getRun().catch((error: unknown) => console.error('Could not load the Tool', error));
    return toolPage.subscribe((next) => {
      const before = state;
      state = next;
      // Speak when a code first appears or a reason changes, not on every keypress.
      if (next.result && !before.result) announcement = text.tool.typed.ready;
      else if (next.reason && next.reason !== before.reason) announcement = next.reason;
      else if (!next.result && !next.reason) announcement = '';
    });
  });

  // Derived, so the picture only reloads when the result changes, not on every keypress.
  let blob = $derived(state.result?.blob);
  $effect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    pictureUrl = url;
    return () => {
      URL.revokeObjectURL(url);
      pictureUrl = undefined;
    };
  });

  const save = () => {
    if (!state.result || state.updating) return;
    saveFiles([state.result]).catch((error: unknown) => console.error('Could not save', error));
  };
</script>

<div class="tool">
  <Options bind:options />

  <label class="typed">
    <span class="label">{tool.typeLabel}</span>
    <textarea
      rows="3"
      disabled={!hydrated}
      oninput={(event) => toolPage.type(event.currentTarget.value, $state.snapshot(options))}
    ></textarea>
  </label>

  {#if state.reason}
    <p class="failed">{state.reason}</p>
  {:else if state.result && pictureUrl}
    <figure class="result">
      <img
        src={pictureUrl}
        alt={fill(text.tool.typed.pictureLabel, { noun: tool.noun.one, typed: state.result.typed })}
      />
      <figcaption class="row">
        <span class="file-name">{state.result.name}</span>
        <button
          type="button"
          class="small-button"
          aria-label={fill(text.tool.saveLabel, { name: state.result.name })}
          disabled={state.updating}
          onclick={save}>{text.tool.save}</button
        >
      </figcaption>
    </figure>
  {/if}

  <div class="visually-hidden" aria-live="polite">
    <p>{announcement}</p>
  </div>
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .typed {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-weight: 600;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 3.5rem;
    padding: 0.75rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
    font: inherit;
    resize: vertical;
  }

  textarea:focus {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  /* Black on white in both themes, so the code always reads. */
  img {
    display: block;
    width: 100%;
    max-width: 20rem;
    height: auto;
    background: #fff;
    image-rendering: pixelated;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }

  .file-name {
    overflow-wrap: anywhere;
    font-weight: 600;
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

  .failed {
    margin: 0;
    color: var(--problem);
  }
</style>
