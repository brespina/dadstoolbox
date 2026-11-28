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
  import { fillText, text } from '../../text';
  import { sitePath } from '../../site/paths';
  import { saveFiles } from '../../site/save';
  // `?worker&inline` builds the worker as a blob worker (ADR-0010): Vite writes it into
  // this file's chunk and starts it from a `blob:` address.
  import PythonWorker from './python-worker?worker&inline';
  import Console from './Console.svelte';
  import ProgramEditor from './ProgramEditor.svelte';
  import KeepChoice from './KeepChoice.svelte';
  import { browserStore, openKept } from './keep';
  import { createConsoleBuffer, type ConsoleRun } from './console-buffer';
  import { tool } from './declaration';
  import { pyodideFolder, programFileName, readProgram, tooBigToRead } from './files';
  import { createRunner, type Runner, type RunnerState } from './runner';

  const { notes } = tool;

  /** Whether the page is cross-origin isolated (Practice.svelte decides, ADR-0009). */
  const { isolated = false }: { isolated?: boolean } = $props();

  // What the visitor chose to Keep, if anything, goes in the editor in place of the starter
  // (and is never run). keep.ts checks it first (ADR-0011).
  const store = browserStore();
  const kept = openKept(store);
  let program = $state(kept.program ?? notes.starter);
  let state: RunnerState = $state.raw({ name: 'gettingReady' });
  let runs: ConsoleRun[] = $state.raw([]);
  let removed = $state(false);
  // The Program waits for a typed line, so the Console shows its typing field.
  let waiting = $state(false);
  let runner: Runner | undefined;

  // The name of the file the visitor chose, which Save names its file after, and the
  // line that says what Choose did (or why it did not). The line is a status, so screen
  // readers hear it.
  let chosenName: string | undefined;
  let fileStatus = $state({ words: '', problem: false });
  let chooser: HTMLInputElement;

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
        clear: clearConsole,
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

  /** Puts the chosen file's text in the editor, or says why not and leaves the Program. */
  async function onChoose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // Reset, so choosing the same file again still counts as a choice.
    input.value = '';
    if (!file) return;
    fileStatus = { words: '', problem: false };
    // A big file is refused by its size alone, without being read.
    if (tooBigToRead(file.size)) {
      fileStatus = { words: notes.tooBig, problem: true };
      return;
    }
    let result: ReturnType<typeof readProgram>;
    try {
      result = readProgram(new Uint8Array(await file.arrayBuffer()));
    } catch {
      fileStatus = { words: notes.couldNotRead, problem: true };
      return;
    }
    if (!result.ok) {
      fileStatus = { words: result.reason, problem: true };
      return;
    }
    chosenName = file.name;
    program = result.text;
    fileStatus = { words: fillText(notes.chosen, { name: file.name }), problem: false };
  }

  async function onSave() {
    await saveFiles([
      {
        name: programFileName(chosenName),
        blob: new Blob([program], { type: 'text/plain;charset=utf-8' }),
      },
    ]);
  }

  const runLabel = $derived(
    waitingForPython
      ? text.tool.gettingReady
      : state.name === 'running' || state.name === 'stopping'
        ? notes.running
        : notes.run,
  );
  const consoleEmpty = $derived(runs.length === 0 && !removed);

  function clearConsole() {
    buffer.clear();
    draw();
  }

  const canRun = $derived(
    state.name === 'ready' || (state.name === 'gettingReady' && !!state.restarted && !state.queued),
  );
</script>

<div class="bar files">
  <button type="button" onclick={() => chooser.click()}>{notes.choose}</button>
  <!-- `accept` lists both the Python type and plain text, as phones differ on which they offer. -->
  <input
    bind:this={chooser}
    type="file"
    accept=".py,text/x-python,text/plain,.txt"
    hidden
    onchange={onChoose}
  />
  <button type="button" onclick={onSave}>{notes.save}</button>
</div>
<p class="status" class:problem={fileStatus.problem} role="status">{fileStatus.words}</p>

<KeepChoice {program} initial={kept.choice} {store} />

<ProgramEditor value={program} onchange={(value) => (program = value)} />

<div class="bar">
  <button type="button" disabled={!canRun} onclick={() => runner?.run(program)}>
    {runLabel}
  </button>
  <button type="button" disabled={state.name !== 'running'} onclick={() => runner?.stop()}>
    {notes.stop}
  </button>
  <button type="button" class="quiet" disabled={consoleEmpty} onclick={clearConsole}>
    {notes.clear}
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

  .files {
    margin-bottom: 0.25rem;
  }

  .files button,
  .quiet:enabled {
    background: var(--bg);
    color: var(--action);
    border: 2px solid var(--action);
  }

  .status {
    margin: 0 0 0.5rem;
    min-height: 1.5em;
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
