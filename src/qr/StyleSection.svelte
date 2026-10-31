<script lang="ts">
  // The shared Style section for the QR code Tools, closed until opened. Its defaults
  // draw today's black-on-white code, so a section never opened changes nothing.
  // A logo (#76) joins it here.
  import { text } from '../text';
  import { saveTypes, shapeNames, type QrStyle } from './style';

  let { style = $bindable() }: { style: QrStyle } = $props();

  const shapeChoices = [
    { field: 'dotShape', legend: text.qr.dotShape, name: 'dot-shape' },
    { field: 'cornerShape', legend: text.qr.cornerShape, name: 'corner-shape' },
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

    {#each shapeChoices as { field, legend, name } (field)}
      <fieldset class="shapes">
        <legend class="label">{legend}</legend>
        <div class="options">
          {#each shapeNames as shape (shape)}
            <label class="choice">
              <input
                type="radio"
                class="visually-hidden"
                {name}
                value={shape}
                bind:group={style[field]}
              />
              <span class="face">{text.qr.shapes[shape]}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {/each}

    <fieldset class="shapes">
      <legend class="label">{text.qr.saveAs}</legend>
      <div class="options">
        {#each saveTypes as type (type)}
          <label class="choice">
            <input
              type="radio"
              class="visually-hidden"
              name="save-as"
              value={type}
              bind:group={style.saveAs}
            />
            <span class="face">{text.qr.saveTypes[type]}</span>
          </label>
        {/each}
      </div>
      {#if style.saveAs === 'svg'}
        <p class="muted hint">{text.qr.svgHint}</p>
      {/if}
    </fieldset>
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

  .shapes {
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

  .check > span {
    display: flex;
    flex-direction: column;
  }
</style>
