<script lang="ts">
  // The shared Style section for the QR code Tools, closed until opened. Its defaults
  // draw today's black-on-white code, so a section never opened changes nothing.
  import { text } from '../text';
  import { saveTypes, shapeNames, type QrStyle } from './style';

  let { style = $bindable() }: { style: QrStyle } = $props();

  // The browser may still offer other files, so the drawing says when one won't open.
  const logoTypes = 'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';
  let logoInput: HTMLInputElement | undefined = $state();

  // The logo is held in memory only, never stored or sent.
  const chooseLogo = (event: Event & { currentTarget: HTMLInputElement }) => {
    const file = event.currentTarget.files?.[0];
    if (file) style.logo = file;
  };

  const removeLogo = () => {
    style.logo = null;
    if (!logoInput) return;
    // Cleared, so choosing the same file again counts as a change.
    logoInput.value = '';
    // The Remove button is gone: keep the place for keyboard users.
    logoInput.focus();
  };

  // Each is a row of big buttons that sets one field of the Style.
  const groups = [
    {
      field: 'dotShape',
      legend: text.qr.dotShape,
      name: 'dot-shape',
      values: shapeNames,
      words: text.qr.shapes,
    },
    {
      field: 'cornerShape',
      legend: text.qr.cornerShape,
      name: 'corner-shape',
      values: shapeNames,
      words: text.qr.shapes,
    },
    {
      field: 'saveAs',
      legend: text.qr.saveAs,
      name: 'save-as',
      values: saveTypes,
      words: text.qr.saveTypes,
    },
  ] as const;
</script>

<details class="style">
  <summary>
    <span class="label">{text.qr.style}</span>
    <span class="muted">{text.qr.styleHint}</span>
  </summary>

  <div class="choices">
    <label class="colour">
      <input type="color" bind:value={style.code} />
      <span class="label">{text.qr.codeColour}</span>
    </label>

    <label class="colour">
      <input type="color" disabled={style.noBackground} bind:value={style.background} />
      <span class="label">{text.qr.backgroundColour}</span>
    </label>

    <label class="check">
      <input type="checkbox" bind:checked={style.noBackground} />
      <span>
        <span class="label">{text.qr.noBackground}</span>
        <span class="muted">{text.qr.noBackgroundHint}</span>
      </span>
    </label>

    <fieldset class="group">
      <legend class="label">{text.qr.logo}</legend>
      <p class="muted hint-above" id="qr-logo-hint">{text.qr.logoHint}</p>
      <div class="logo">
        <label class="choice">
          <input
            bind:this={logoInput}
            type="file"
            class="visually-hidden"
            accept={logoTypes}
            aria-describedby="qr-logo-hint"
            onchange={chooseLogo}
          />
          <span class="face">{text.qr.chooseLogo}</span>
        </label>
        {#if style.logo}
          <span class="file-name">{style.logo.name}</span>
          <button type="button" class="face remove" onclick={removeLogo}>
            {text.qr.removeLogo}
          </button>
        {/if}
      </div>
    </fieldset>

    {#each groups as { field, legend, name, values, words } (field)}
      <fieldset class="group">
        <legend class="label">{legend}</legend>
        <div class="options">
          {#each values as value (value)}
            <label class="choice">
              <input
                type="radio"
                class="visually-hidden"
                {name}
                {value}
                bind:group={style[field]}
              />
              <span class="face">{words[value as keyof typeof words]}</span>
            </label>
          {/each}
        </div>
        {#if field === 'saveAs'}
          <p class="muted hint">{text.qr.saveAsHint}</p>
        {/if}
      </fieldset>
    {/each}
  </div>
</details>

<style>
  .style {
    border: 2px solid var(--line);
    border-radius: 0.5rem;
  }

  /* At least 44 px tall to tap. */
  summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.75rem;
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
  }

  /* The open-or-closed arrow, kept in the flex row. */
  summary::before {
    content: '▸';
    color: var(--action);
  }

  .style[open] summary::before {
    content: '▾';
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0 0.75rem 0.75rem;
  }

  .label {
    font-weight: 600;
  }

  .colour,
  .check {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
    cursor: pointer;
  }

  /* A swatch at least 44 x 44 px to tap. */
  input[type='color'] {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0.125rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    flex-shrink: 0;
    cursor: pointer;
  }

  input[type='color']:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  input[type='color']:focus-visible,
  input[type='checkbox']:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .check {
    align-items: flex-start;
  }

  input[type='checkbox'] {
    width: 1.5rem;
    height: 1.5rem;
    margin: 0.1rem 0.625rem 0;
    flex-shrink: 0;
    accent-color: var(--action);
  }

  .group {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.5rem;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
    gap: 0.5rem;
  }

  /* Each choice is a big button; the chosen one is filled in. */
  .choice {
    display: flex;
    cursor: pointer;
  }

  .face {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 2.75rem;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--action);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
    font-weight: 600;
  }

  input:checked + .face {
    background: var(--action);
    color: var(--action-text);
  }

  input:focus-visible + .face {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .hint {
    margin: 0.5rem 0 0;
  }

  .hint-above {
    margin: 0 0 0.5rem;
  }

  .logo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  .file-name {
    overflow-wrap: anywhere;
    font-weight: 600;
  }

  /* A button with the choice look, but never filled in. */
  .remove {
    width: auto;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .remove:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .check > span {
    display: flex;
    flex-direction: column;
  }
</style>
