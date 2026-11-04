<script lang="ts">
  // Vim practice's page. The engine (vim.ts), the search (fewest.ts) and the round
  // (round.ts) do the work; this turns key events into key presses, shows the Drill and
  // shows the score at the end.
  //
  // Keys are read as `KeyboardEvent.key`, the character the visitor's own keyboard types,
  // so Vim on Colemak or Dvorak works as it does in their editor.
  import { onMount, untrack } from 'svelte';
  import { fillText } from '../../text';
  import { pageRandom } from '../../practice/random';
  import { isShortcut, startsPractice, watchTouchOnly } from '../../practice/keys';
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
  import Headline from '../../practice/Headline.svelte';
  import Restart from '../../practice/Restart.svelte';
  import StartHint from '../../practice/StartHint.svelte';
  import { tool } from './declaration';
  import { lessonKeys, lessonLabel, lessons } from './lessons';
  import { drillsInRound, newRound, press, results, type Round } from './round';

  const { notes } = tool;
  const lessonChoices = lessons.map((lesson, i) => ({ value: i, label: lessonLabel(lesson) }));

  let lesson = $state(0);
  let round: Round | undefined = $state.raw();
  let announcement = $state('');
  let focused = $state(false);
  // A phone or tablet with no keyboard can't play; the page says so plainly.
  let touchOnly = $state(false);
  let area: HTMLElement;

  const drill = $derived(round?.drills[round.current]);
  const score = $derived(round && results(round));
  const allowedKeys = $derived(lessonKeys(lesson));

  /** A new round of Drills. With `?seed=` in the address, the same Drills each time. */
  function restart() {
    round = newRound(lesson, pageRandom(location.search));
    announcement = '';
  }

  // A changed Lesson starts a new round (and the first round, once the page runs).
  $effect(() => {
    void lesson;
    untrack(restart);
  });

  onMount(() => watchTouchOnly((value) => (touchOnly = value)));

  function send(key: string) {
    if (!round) return;
    round = press(round, key, performance.now());
    const done = results(round);
    if (done) {
      announcement = fillText(notes.done, {
        seconds: done.seconds,
        presses: done.presses,
        fewest: done.fewest,
      });
    }
  }

  function onkeydown(event: KeyboardEvent) {
    // Tab moves on as usual and shortcuts stay the browser's. Shift, arrows and other
    // named keys aren't Vim key presses, so they aren't counted.
    if (event.key === 'Tab' || event.isComposing || isShortcut(event)) return;
    if (!round || score) return;
    if (event.key !== 'Escape' && event.key.length !== 1) return;
    event.preventDefault();
    // A held key counts once: a count is the way to move far.
    if (event.repeat) return;
    send(event.key);
  }

  // "Press any key to start": a key typed anywhere else on the page goes to the area.
  function onWindowKeydown(event: KeyboardEvent) {
    if (focused || score || !startsPractice(event)) return;
    area.focus();
    onkeydown(event);
  }

  function restartFromButton() {
    restart();
    area.focus();
  }

  const keyName = (key: string) => (key === ' ' ? notes.space : key);
</script>

<svelte:window onkeydown={onWindowKeydown} />

<ChoiceGroup legend={notes.lesson} name="lesson" choices={lessonChoices} bind:value={lesson} />

{#if touchOnly}
  <p class="needs-keyboard">{notes.needsKeyboard}</p>
{/if}

<!-- The practice area takes every key, as an editor does; "application" tells screen
     readers to pass the keys through. -->
<div
  bind:this={area}
  class="area"
  class:focused
  role="application"
  tabindex="0"
  aria-label={tool.areaLabel}
  aria-describedby="vim-where"
  {onkeydown}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
>
  {#if round && score}
    <div class="results">
      <Headline
        items={[
          { label: notes.time, value: fillText(notes.seconds, { seconds: score.seconds }) },
          { label: notes.presses, value: score.presses },
          { label: notes.fewest, value: score.fewest, plain: true },
        ]}
      />
      {#if score.mostExtra.length > 0}
        <h2>{notes.mostExtra}</h2>
        <ol class="extra">
          {#each score.mostExtra as worst (worst.drill)}
            <li>
              {fillText(notes.drillExtra, {
                number: worst.drill + 1,
                presses: worst.presses,
                extra: worst.extra,
              })}
            </li>
          {/each}
        </ol>
      {:else}
        <p>{notes.noExtra}</p>
      {/if}
    </div>
  {:else if round && drill}
    {@const cursor = round.vim.cursor}
    <div class="bar">
      <p class="counter">{round.current + 1}/{drillsInRound}</p>
      <!-- A count and the start of a motion (3, or f, or g) typed so far, where Vim shows them. -->
      <p class="pending" aria-hidden="true">{round.vim.count ?? ''}{round.vim.keys ?? ''}</p>
    </div>
    <div class="buffer" aria-hidden="true">
      {#each drill.text as line, l (l)}
        <div class="line" class:current={l === cursor.line}>
          <!-- Lines counted from the cursor's, as with Vim's relativenumber: the count for j or k. -->
          <span class="number">{Math.abs(l - cursor.line)}</span>
          <span class="chars"
            >{#each line === '' ? [' '] : [...line] as char, c (c)}<span
                class="char"
                class:cursor={l === cursor.line && c === cursor.col}
                class:target={l === drill.target.line && c === drill.target.col}>{char}</span
              >{/each}</span
          >
        </div>
      {/each}
    </div>
    <p class="note" class:ignored={round.ignored !== undefined}>
      {round.ignored === undefined
        ? notes.goal
        : fillText(notes.ignored, { key: keyName(round.ignored) })}
    </p>
    {#if !focused}
      <StartHint />
    {/if}
  {/if}
</div>

<p id="vim-where" class="visually-hidden">
  {#if round && drill}
    {fillText(notes.where, {
      line: round.vim.cursor.line + 1,
      col: round.vim.cursor.col + 1,
      targetLine: drill.target.line + 1,
      targetCol: drill.target.col + 1,
    })}
  {/if}
</p>

<div class="help">
  <p class="allowed">
    <span class="muted">{notes.allowed}</span>
    {#each allowedKeys as key (key)}
      <kbd>{key}</kbd>
    {/each}
  </p>
  <p class="muted">{notes.countHint}</p>
</div>

<Restart label={notes.newRound} onclick={restartFromButton} />

<p class="visually-hidden" role="status">{announcement}</p>

<style>
  .needs-keyboard {
    margin: 1rem 0 0;
    padding: 0.75rem 1rem;
    border-left: 4px solid var(--focus);
    background: var(--surface);
    font-weight: 600;
  }

  .area {
    position: relative;
    margin: 1rem -0.5rem 0;
    padding: 0.5rem;
    border-radius: 0.5rem;
  }

  .area:focus {
    outline: none;
  }

  .area.focused {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .bar {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .bar p {
    margin: 0 0 0.25rem;
    min-height: 1.5em;
  }

  .counter {
    color: var(--action);
    font-size: 1.25rem;
    font-weight: 600;
  }

  .pending {
    color: var(--muted);
    font-size: 1.25rem;
  }

  /* The text, set like an editor: a gutter of line counts, then the lines. Sized so a
     32-character line fits a phone. */
  .buffer {
    --row: 1.7em;
    min-height: calc(var(--row) * 6);
    padding: 0.5rem 0;
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: var(--surface);
    font-family: var(--mono);
    font-size: clamp(0.875rem, 4vw, 1.375rem);
    line-height: var(--row);
    white-space: pre;
  }

  .area:not(.focused) .buffer {
    filter: blur(3px);
  }

  .line {
    display: flex;
  }

  .number {
    flex: none;
    width: 3ch;
    padding-right: 1ch;
    margin-right: 1ch;
    border-right: 1px solid var(--line);
    color: var(--muted);
    text-align: right;
    font-variant-numeric: tabular-nums;
    user-select: none;
  }

  .line.current .number {
    color: var(--text);
    font-weight: 700;
  }

  .char {
    display: inline-block;
    min-width: 1ch;
  }

  /* Vim's block cursor. */
  .char.cursor {
    background: var(--action);
    color: var(--action-text);
  }

  /* The target: a dashed box and a bar under it, so it shows without colour too. */
  .char.target {
    outline: 2px dashed var(--focus);
    outline-offset: -1px;
    box-shadow: inset 0 -0.2em 0 var(--focus);
    font-weight: 700;
  }

  .note {
    margin: 0.5rem 0 0;
    min-height: 1.5em;
    color: var(--muted);
  }

  .note.ignored {
    color: var(--text);
  }

  .help {
    margin-top: 0.75rem;
    font-size: 0.95rem;
  }

  .help p {
    margin: 0.25rem 0;
  }

  .allowed {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .allowed .muted {
    margin-right: 0.25rem;
  }

  kbd {
    min-width: 1.75rem;
    padding: 0.125rem 0.375rem;
    border: 1px solid var(--line);
    border-bottom-width: 2px;
    border-radius: 0.25rem;
    background: var(--surface);
    font-family: var(--mono);
    text-align: center;
  }

  h2 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }

  .extra {
    margin: 0;
    padding-left: 1.5rem;
  }

  .extra li {
    padding: 0.25rem 0;
  }
</style>
