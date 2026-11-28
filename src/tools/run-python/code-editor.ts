// The code editor's CodeMirror setup (#130), kept apart from the Svelte file so that one
// place says what the editor is: line numbers, history, the default keys, Tab to indent,
// Python's colours and its indent after a line that ends in ":". Nothing here is imported
// by another Tool's page; ProgramEditor.svelte is the only door.
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { tags } from '@lezer/highlight';

// Every colour is a `--code-*` token from base.css, so the editor follows the Site's light
// and dark themes. Custom properties cross the shadow root the editor lives in.
const words = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--code-keyword)' },
  { tag: tags.string, color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  {
    tag: [tags.definition(tags.variableName), tags.function(tags.variableName), tags.className],
    color: 'var(--code-name)',
  },
]);

const look = EditorView.theme({
  '&': {
    color: 'var(--code-text)',
    backgroundColor: 'var(--code-bg)',
    // 16 px or more, so iPhone Safari does not zoom in when the editor takes focus.
    fontSize: '1rem',
  },
  '&.cm-focused': { outline: '3px solid var(--focus)', outlineOffset: '-3px' },
  '.cm-content, .cm-gutter': { minHeight: '14rem' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.5' },
  '.cm-content': { caretColor: 'var(--code-text)', padding: '0.5rem 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--code-text)' },
  '.cm-gutters': {
    backgroundColor: 'var(--code-gutter-bg)',
    color: 'var(--code-gutter)',
    border: 'none',
  },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
    { backgroundColor: 'var(--code-select)' },
});

export interface CodeEditor {
  /** The text now in the editor. */
  text(): string;
  /** Replaces the text, as when the page sets a new Program. */
  setText(text: string): void;
  focus(): void;
  destroy(): void;
}

/**
 * Mounts the editor in `root` (a shadow root: CodeMirror adds its styles as a `<style>`
 * element, which the Site's style hashes block, but in a shadow root it adopts a
 * stylesheet instead). `label` names the editable area for screen readers.
 */
export function mountCodeEditor(options: {
  root: ShadowRoot;
  text: string;
  label: string;
  onchange: (text: string) => void;
}): CodeEditor {
  const view = new EditorView({
    parent: options.root,
    root: options.root,
    state: EditorState.create({
      doc: options.text,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        python(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        syntaxHighlighting(words),
        // Tab indents and Shift+Tab takes the indent away. CodeMirror lets a keyboard
        // user out: Escape, then Tab, moves focus on.
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        // Lines wrap, so a phone never scrolls sideways.
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': options.label,
          'aria-multiline': 'true',
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false',
        }),
        look,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onchange(update.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    text: () => view.state.doc.toString(),
    setText(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
