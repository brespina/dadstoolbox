<script lang="ts">
  // The Run Python page proper, loaded by Practice.svelte once the page is open. It
  // starts Python in its blob worker, holds the Program, and shows the Console.
  //
  // - runner.ts keeps the state (getting ready, ready, running, stopping, failed) and talks to the
  //   worker; this file only turns it into buttons and words.
  // - The Console is console-buffer.ts. Output is added to it as it comes and drawn at most
  //   once per animation frame, so a Program that prints a great deal leaves the page quick.
  // - ProgramEditor.svelte is the editor seam (see there).
  import { onMount } from 'svelte';
  import { text } from '../../text';
  import { sitePath } from '../../site/paths';
  // `?worker&inline` builds the worker as a blob worker (ADR-0010): Vite writes it into
  // this file's chunk and starts it from a `blob:` address.
  import PythonWorker from './python-worker?worker&inline';
  import Console from './Console.svelte';
  import ProgramEditor from './ProgramEditor.svelte';
  import { createConsoleBuffer, type ConsoleRun } from './console-buffer';
  import { tool } from './declaration';
  import { pyodideFolder } from './files';
  import { createRunner, type Runner, type RunnerState } from './runner';

  const { notes } = tool;

  /** Whether the page is cross-origin isolated (Practice.svelte decides, ADR-0009). */
  const { isolated = false }: { isolated?: boolean } = $props();

  let program = $state(notes.starter);
  let state: RunnerState = $state.raw({ name: 'gettingReady' });
  let runs: ConsoleRun[] = $state.raw([]);
  let removed = $state(false);
  // The Program waits for a typed line, so the Console shows its typing field.
  let waiting = $state(false);
  let runner: Runner | undefined;

  const buffer = createConsoleBuffer();
  let frame = 0;

  /** Draws the Console, at most once per animation frame however much was written. */
  function draw() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      runs = buffer.runs();
      removed = buffer.removed();
    });
  }

  onMount(() => {
    runner = createRunner({
      // An absolute address: a blob worker has no address to resolve a relative one from.
      base: new URL(sitePath(pyodideFolder), location.href).href,
      makeWorker: () => new PythonWorker(),
      reasons: {
        didNotStart: notes.didNotStart,
        tookTooLong: notes.tookTooLong,
      },
      words: {
        done: notes.done,
        missingModule: notes.onlyBuiltIn,
        noInput: notes.noInput,
        stopped: notes.stoppedLine,
        died: notes.died,
      },
      isolated,
      onState: (next) => (state = next),
      onInput: (is) => (waiting = is),
      console: {
        clear() {
          buffer.clear();
          draw();
        },
        write(chunk, stream) {
          buffer.write(chunk, stream);
          draw();
        },
      },
    });
    runner.start();
    return () => {
      runner?.dispose();
      cancelAnimationFrame(frame);
    };
  });

  // On the first load Run waits, greyed. After Stop or a death a fresh Python loads while the
  // visitor edits: Run stays pressable, and once pressed it says "Getting ready…" and runs
  // the Program as soon as Python is ready.
  const waitingForPython = $derived(
    state.name === 'gettingReady' && (!state.restarted || !!state.queued),
  );
  const runLabel = $derived(
    waitingForPython
      ? text.tool.gettingReady
      : state.name === 'running' || state.name === 'stopping'
        ? notes.running
        : notes.run,
  );
  const canRun = $derived(
    state.name === 'ready' || (state.name === 'gettingReady' && !!state.restarted && !state.queued),
  );
</script>

<ProgramEditor value={program} onchange={(value) => (program = value)} />

<div class="bar">
  <button type="button" disabled={!canRun} onclick={() => runner?.run(program)}>
    {runLabel}
  </button>
  <button type="button" disabled={state.name !== 'running'} onclick={() => runner?.stop()}>
    {notes.stop}
  </button>
  {#if state.name === 'failed'}
    <p class="problem" role="alert">{state.reason}</p>
    <button type="button" class="again" onclick={() => runner?.retry()}>{notes.tryAgain}</button>
  {/if}
</div>

{#if !isolated}
  <p class="limit">{notes.noIsolation}</p>
{/if}

<Console {runs} {removed} {waiting} onanswer={(line) => runner?.answer(line)} />

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin: 0.75rem 0;
  }

  button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0 1.25rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--action);
    color: var(--action-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    background: var(--surface);
    color: var(--muted);
    border: 1px solid var(--line);
    cursor: default;
  }

  .limit {
    margin: 0 0 0.75rem;
    color: var(--muted);
  }

  .problem {
    margin: 0;
    color: var(--problem);
    font-weight: 600;
  }
</style>
