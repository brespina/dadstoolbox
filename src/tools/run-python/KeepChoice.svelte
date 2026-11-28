<script lang="ts">
  // The visitor's choice to Keep their Program in this browser (#132, ADR-0011), with one
  // plain line saying what the chosen option does. keep.ts holds the rules and the
  // storage; this file turns them into a choice and words.
  //
  // - `program` is the Program as it now stands. Every change to it (typing, or a chosen
  //   file) goes to keep.ts, which writes it a moment after the changes stop.
  // - When Keep can't be had (no storage, or storage refuses), the choice goes back to
  //   Never keep and a line says so. It never shows Keep without something stored.
  import { onMount, untrack } from 'svelte';
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import { tool } from './declaration';
  import { createKeeper, type KeepChoice, type KeepStore } from './keep';

  const { notes } = tool;

  let {
    program,
    initial,
    store,
  }: { program: string; initial: KeepChoice; store: KeepStore | undefined } = $props();

  const choices: { value: KeepChoice; label: string }[] = [
    { value: 'never', label: notes.neverKeep },
    { value: 'keep', label: notes.keepProgram },
  ];

  // The props are read once, when the page opens.
  // svelte-ignore state_referenced_locally
  let choice: KeepChoice = $state(initial);
  // What keep.ts has been told, so a change of the radio is told to it only once.
  // svelte-ignore state_referenced_locally
  let applied: KeepChoice = initial;
  let refused = $state(false);

  /** Keep could not be had: the choice goes back to Never keep, with the reason. */
  function refuse() {
    refused = true;
    applied = 'never';
    choice = 'never';
  }

  const keeper = createKeeper({
    store,
    // svelte-ignore state_referenced_locally
    initial,
    onRefused: refuse,
  });

  $effect(() => {
    const wanted = choice;
    if (wanted === applied) return;
    applied = wanted;
    // If refused, the radio showed Keep for a moment; it goes back, with the reason.
    if (untrack(() => keeper.choose(wanted, program))) refused = false;
    else refuse();
  });

  // Every change to the Program, however it came about.
  $effect(() => keeper.edited(program));

  onMount(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') keeper.flush();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', keeper.flush);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', keeper.flush);
      keeper.dispose();
    };
  });
</script>

<div class="keep">
  <ChoiceGroup legend={notes.keepLegend} name="run-python-keep" {choices} bind:value={choice} />
  <p class="words">{choice === 'keep' ? notes.keepWords : notes.neverKeepWords}</p>
  <p class="problem" role="status">{refused ? notes.cannotKeep : ''}</p>
</div>

<style>
  .keep {
    margin: 0.75rem 0;
  }

  .words {
    margin: 0.5rem 0 0;
  }

  .problem {
    margin: 0.25rem 0 0;
    min-height: 1.5em;
    color: var(--problem);
    font-weight: 600;
  }
</style>
