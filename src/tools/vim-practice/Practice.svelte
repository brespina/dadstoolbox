<script lang="ts">
  // Vim practice's page. The engine (vim.ts), the search (fewest.ts) and the round
  // (round.ts) do the work; this turns key events into key presses, shows the Drill and
  // shows the score at the end.
  //
  // Keys are read as `KeyboardEvent.key`, the character the visitor's own keyboard types,
  // so Vim on Colemak or Dvorak works as it does in their editor.
  import { untrack } from 'svelte';
  import { fillText } from '../../text';
  import { pageRandom } from '../../practice/random';
  import ChoiceGroup from '../../practice/ChoiceGroup.svelte';
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

  $effect(() => {
    touchOnly =
      matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  });

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

  /**
   * A shortcut such as Ctrl+R, which stays the browser's. AltGr (Ctrl+Alt on Windows)
   * types characters such as { on many keyboards, so it counts as typing.
   */
  function isShortcut(event: KeyboardEvent): boolean {
    const altGr = event.ctrlKey && event.altKey && !event.metaKey;
    return !altGr && (event.ctrlKey || event.metaKey || event.altKey);
  }

  function onkeydown(event: KeyboardEvent) {
    // Tab moves on as usual. Shift, arrows and other named keys aren't Vim key presses,
    // so they aren't counted.
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
    if (focused || event.defaultPrevented || score) return;
    if (event.key.length !== 1 || event.key === ' ') return;
    if (isShortcut(event)) return;
    const active = document.activeElement;
    const typingElsewhere =
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLInputElement && !['radio', 'checkbox'].includes(active.type)) ||
      (active instanceof HTMLElement && active.isContentEditable);
    if (typingElsewhere) return;
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
      <dl class="headline">
        <div>
          <dt>{notes.time}</dt>
          <dd>{fillText(notes.seconds, { seconds: score.seconds })}</dd>
        </div>
        <div>
          <dt>{notes.presses}</dt>
          <dd>{score.presses}</dd>
        </div>
        <div>
          <dt>{notes.fewest}</dt>
          <dd class="fewest">{score.fewest}</dd>
        </div>
      </dl>
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
      <p class="start">{notes.start}</p>
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

<div class="restart">
  <button type="button" onclick={restartFromButton}>{notes.newRound}</button>
  <span class="muted">{notes.restartHint}</span>
</div>

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

  .start {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 1rem;
    font-weight: 600;
    text-align: center;
    cursor: text;
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

  dl {
    margin: 0;
  }

  dd {
    margin: 0;
  }

  .headline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 2.5rem;
    margin-bottom: 1rem;
  }

  .headline dt {
    color: var(--muted);
  }

  .headline dd {
    color: var(--action);
    font-family: var(--mono);
    font-size: 3rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .headline dd.fewest {
    color: var(--text);
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

  .restart {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin-top: 1.25rem;
  }

  button {
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
</style>
