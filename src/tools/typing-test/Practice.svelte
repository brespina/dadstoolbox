<script lang="ts">
  // The typing test's page. The test itself lives in typing.ts; this turns key events
  // into key presses, shows the words and the caret, and shows the score at the end.
  //
  // Key presses arrive on an unseen text box over the words, so a phone opens its
  // on-screen keyboard there. A key with a known character is read on keydown; a phone's
  // keyboard, which often names no key, is read from the text it would type instead.
  import { untrack } from 'svelte';
  import { fillText } from '../../text';
  import { pageRandom } from '../../practice/random';
  import { tool } from './declaration';
  import { wordStream } from './words';
  import {
    addWords,
    newTest,
    press,
    score,
    status,
    wordLetters,
    type KeyPress,
    type Score,
    type TypingTest,
  } from './typing';
  import { defaultSettings, testLength, type TypingSettings } from './settings';
  import SettingsBar from './SettingsBar.svelte';

  const { notes } = tool;
  // A Time test takes words in batches of this many, asking for more near the end.
  const batch = 50;

  let settings: TypingSettings = $state({ ...defaultSettings });
  let test: TypingTest = $state.raw(newTest(testLength(defaultSettings), []));
  let nextWords = (_count: number): string[] => [];
  let result: Score | undefined = $state();
  let announcement = $state('');
  let focused = $state(false);
  // The settings bar fades while the visitor types, until the mouse moves.
  let quiet = $state(false);
  let now = $state(0);

  let input: HTMLInputElement;
  let lines: HTMLElement;
  let caret = $state({ x: 0, y: 0 });
  let scrolled = $state(0);

  const phase = $derived(status(test));
  const current = $derived(test.typed.length - 1);

  /** A new test with new words. With `?seed=` in the address, the same words each time. */
  function restart() {
    nextWords = wordStream(pageRandom(location.search));
    const length = testLength(settings);
    test = newTest(length, nextWords(length.kind === 'words' ? length.count : batch));
    result = undefined;
    announcement = '';
    quiet = false;
  }

  // A changed setting starts a new test (and the first test, once the page runs).
  $effect(() => {
    testLength(settings);
    untrack(restart);
  });

  function send(key: KeyPress) {
    const before = status(test);
    let next = press(test, key);
    if (next.length.kind === 'time' && next.typed.length > next.words.length - 20) {
      next = addWords(next, nextWords(batch));
    }
    test = next;
    const after = status(next);
    if (after === 'typing') quiet = true;
    if (after === 'done' && before !== 'done') {
      result = score(next);
      quiet = false;
      announcement = fillText(notes.done, { wpm: result.wpm, accuracy: result.accuracy });
    }
  }

  // The clock: a Time test ends on time even when no key is pressed.
  $effect(() => {
    if (phase !== 'typing') return;
    const timer = setInterval(() => {
      now = performance.now();
      send({ type: 'tick', at: now });
    }, 100);
    return () => clearInterval(timer);
  });

  const counter = $derived.by(() => {
    if (test.length.kind === 'words') return `${test.wordEnds.length}/${test.length.count}`;
    if (test.startedAt === undefined) return String(test.length.seconds);
    const left = test.startedAt + test.length.seconds * 1000 - now;
    return String(Math.max(0, Math.ceil(left / 1000)));
  });

  function onkeydown(event: KeyboardEvent) {
    // Tab moves to Restart as usual; shortcuts such as Ctrl+R stay the browser's.
    if (event.key === 'Tab' || event.isComposing || event.metaKey) return;
    if (phase === 'done') return;
    const at = performance.now();
    if (event.key === 'Backspace') {
      event.preventDefault();
      now = at;
      send({ type: event.ctrlKey || event.altKey ? 'clearWord' : 'backspace', at });
    } else if (event.key.length === 1 && !event.ctrlKey) {
      event.preventDefault();
      now = at;
      send({ type: 'char', char: event.key, at });
    }
  }

  // A phone's keyboard often names no key on keydown; read what it would type instead.
  function onbeforeinput(event: InputEvent) {
    if (phase === 'done') return event.preventDefault();
    const at = performance.now();
    now = at;
    if (event.inputType === 'insertText' && event.data) {
      event.preventDefault();
      for (const char of event.data) send({ type: 'char', char, at });
    } else if (event.inputType === 'deleteWordBackward') {
      event.preventDefault();
      send({ type: 'clearWord', at });
    } else if (event.inputType.startsWith('delete')) {
      event.preventDefault();
      send({ type: 'backspace', at });
    }
  }

  // Text that still lands in the box, such as a word a phone's keyboard finished.
  function oninput() {
    const typed = input.value;
    input.value = '';
    if (phase === 'done') return;
    const at = performance.now();
    for (const char of typed) send({ type: 'char', char, at });
  }

  // "Press any key to start": a letter typed anywhere else on the page starts typing.
  function onWindowKeydown(event: KeyboardEvent) {
    if (focused || event.defaultPrevented || phase === 'done') return;
    if (event.key.length !== 1 || event.key === ' ') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const active = document.activeElement;
    const typingElsewhere =
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLInputElement && !['radio', 'checkbox'].includes(active.type)) ||
      (active instanceof HTMLElement && active.isContentEditable);
    if (typingElsewhere) return;
    input.focus();
    onkeydown(event);
  }

  function restartFromButton() {
    restart();
    input.focus();
  }

  // Moves the caret to the next letter, and keeps the current line second of three.
  $effect(() => {
    if (!lines || phase === 'done') return;
    const typed = test.typed[current] ?? '';
    const word = lines.querySelectorAll<HTMLElement>('.word')[current];
    if (!word) return;
    const letters = word.querySelectorAll<HTMLElement>('.letter');
    const next = letters[typed.length];
    const last = letters[letters.length - 1];
    caret = next
      ? { x: next.offsetLeft, y: next.offsetTop }
      : last
        ? { x: last.offsetLeft + last.offsetWidth, y: last.offsetTop }
        : { x: word.offsetLeft, y: word.offsetTop };
    const lineHeight = parseFloat(getComputedStyle(lines).lineHeight);
    const line = Math.round(word.offsetTop / lineHeight);
    scrolled = Math.max(0, line - 1) * lineHeight;
  });
</script>

<svelte:window onkeydown={onWindowKeydown} onmousemove={() => (quiet = false)} />

<SettingsBar bind:settings {quiet} />

<div class="area" class:focused class:done={phase === 'done'}>
  {#if result}
    <div class="results">
      <dl class="headline">
        <div>
          <dt>{notes.wpm}</dt>
          <dd>{result.wpm}</dd>
        </div>
        <div>
          <dt>{notes.accuracy}</dt>
          <dd>{fillText(notes.percent, { accuracy: result.accuracy })}</dd>
        </div>
      </dl>
      <dl class="details">
        <div>
          <dt>{notes.rawWpm}</dt>
          <dd>{result.rawWpm}</dd>
        </div>
        <div>
          <dt>{notes.lettersRight}</dt>
          <dd>{result.characters.correct}</dd>
        </div>
        <div>
          <dt>{notes.lettersWrong}</dt>
          <dd>{result.characters.wrong}</dd>
        </div>
        <div>
          <dt>{notes.lettersExtra}</dt>
          <dd>{result.characters.extra}</dd>
        </div>
        <div>
          <dt>{notes.lettersMissed}</dt>
          <dd>{result.characters.missed}</dd>
        </div>
        <div>
          <dt>{notes.test}</dt>
          <dd>
            {test.length.kind === 'time'
              ? fillText(notes.testTime, { seconds: test.length.seconds })
              : fillText(notes.testWords, { count: test.length.count })}
          </dd>
        </div>
      </dl>
      <p class="raw-hint">{notes.rawHint}</p>
    </div>
  {:else}
    <p class="counter">{counter}</p>
    <div class="window">
      <div class="lines" bind:this={lines} style:transform={`translateY(${-scrolled}px)`}>
        {#each test.words as target, i (i)}
          {@const typed = test.typed[i] ?? ''}
          <span class="word" class:missed={i < current && typed !== target}>
            {#each wordLetters(target, typed) as letter, l (l)}
              <span class="letter {letter.kind}">{letter.char}</span>
            {/each}
          </span>{' '}
        {/each}
        <span
          class="caret"
          class:waiting={phase === 'waiting'}
          aria-hidden="true"
          style:transform={`translate(${caret.x}px, ${caret.y}px)`}
        ></span>
      </div>
    </div>
    {#if !focused}
      <p class="start">{notes.start}</p>
    {/if}
  {/if}
  <input
    bind:this={input}
    class="keys"
    type="text"
    aria-label={tool.areaLabel}
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    {onkeydown}
    {onbeforeinput}
    {oninput}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
  />
</div>

<div class="restart">
  <button type="button" onclick={restartFromButton}>{notes.restart}</button>
  <span class="muted">{notes.restartHint}</span>
</div>

<p class="visually-hidden" role="status">{announcement}</p>

<style>
  .area {
    --untyped: #707070;
    position: relative;
    border-radius: 0.5rem;
    margin: 0 -0.5rem;
    padding: 0.5rem;
  }

  @media (prefers-color-scheme: dark) {
    .area {
      --untyped: #8a8a8a;
    }
  }

  .area.focused {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .counter {
    font-family: var(--mono);
    margin: 0 0 0.25rem;
    min-height: 1.5em;
    color: var(--action);
    font-size: 1.25rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* Three lines of words; the current line stays the middle one. */
  .window {
    --row: 2.75rem;
    height: calc(var(--row) * 3);
    overflow: hidden;
    font-family: var(--mono);
    font-size: 1.5rem;
    line-height: var(--row);
  }

  .area:not(.focused) .window {
    filter: blur(3px);
  }

  .lines {
    position: relative;
    transition: transform 0.15s ease;
  }

  .word {
    display: inline-block;
  }

  .word.missed {
    text-decoration: underline var(--problem) 2px;
    text-underline-offset: 0.3em;
  }

  .letter.untyped {
    color: var(--untyped);
  }

  .letter.right {
    color: var(--text);
  }

  .letter.wrong,
  .letter.extra {
    color: var(--problem);
  }

  .letter.extra {
    text-decoration: underline dotted;
  }

  .caret {
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: var(--row);
    background: var(--action);
    transition: transform 0.1s ease;
  }

  .caret.waiting {
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
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
  }

  /* The unseen box that takes the key presses covers the area, so a click or tap
     anywhere on it starts typing. 16 px text keeps iPhones from zooming in. */
  .keys {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    font-size: 16px;
    cursor: text;
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

  .details div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.375rem 0;
    border-top: 1px solid var(--line);
  }

  .details dd {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .raw-hint {
    margin: 0.5rem 0 0;
    color: var(--muted);
    font-size: 0.9rem;
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
