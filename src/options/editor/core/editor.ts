import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from "@codemirror/language";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  tooltips,
} from "@codemirror/view";
import { materialDark } from "@fsegurai/codemirror-theme-material-dark";
import { cssLinter } from "../features/syntax";
import { rainbowBrackets } from "../features/syntax";
import { onChange } from "../features/themes";

export const SAVE_DEBOUNCE_DELAY = 1000;
export const SAVE_CUSTOM_THEME_DEBOUNCE = 2000;
export const SYNC_STORAGE_LIMIT = 7000;
export const MAX_RETRY_ATTEMPTS = 3;
export const BRACKET_NESTING_LEVELS = 7;
export const CHUNK_SIZE = 100 * 1024;
export const LOCAL_STORAGE_SAFE_LIMIT = 500 * 1024;

export const stylelintConfig = {
  rules: {
    "annotation-no-unknown": true,
    "at-rule-no-unknown": true,
    "comment-no-empty": true,
    "custom-property-no-missing-var-function": true,
    "declaration-block-no-duplicate-custom-properties": true,
    "declaration-block-no-duplicate-properties": [
      true,
      {
        ignore: ["consecutive-duplicates-with-different-syntaxes"],
      },
    ],
    "declaration-block-no-shorthand-property-overrides": true,
    "declaration-property-value-no-unknown": true,
    "font-family-no-duplicate-names": true,
    "font-family-no-missing-generic-family-keyword": true,
    "function-calc-no-unspaced-operator": true,
    "keyframe-block-no-duplicate-selectors": true,
    "keyframe-declaration-no-important": true,
    "media-feature-name-no-unknown": true,
    "media-feature-name-value-no-unknown": true,
    "media-query-no-invalid": true,
    "named-grid-areas-no-invalid": true,
    "no-descending-specificity": true,
    "no-duplicate-at-import-rules": true,
    "no-duplicate-selectors": true,
    "no-invalid-double-slash-comments": true,
    "no-invalid-position-at-import-rule": true,
    "no-irregular-whitespace": true,
    "property-no-unknown": true,
    "selector-anb-no-unmatchable": true,
    "selector-pseudo-class-no-unknown": true,
    "selector-pseudo-element-no-unknown": true,
    "selector-type-no-unknown": [
      true,
      {
        ignore: ["custom-elements"],
      },
    ],
    "string-no-newline": [true, { ignore: ["at-rule-preludes", "declaration-values"] }],
  },
};

export function createEditorState(initialContents: string) {
  let extensions = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    indentUnit.of("  "),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search(),
    keymap.of([
      { key: "Tab", run: acceptCompletion },
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
      ...searchKeymap,
    ]),
    css(),
    lintGutter(),
    cssLinter,
    tooltips(),
    materialDark,
    rainbowBrackets(),
    EditorView.updateListener.of(update => {
      let text = update.state.doc.toString();
      if (update.docChanged && !text.startsWith("Loading")) {
        onChange(text);
      }
    }),
  ];

  return EditorState.create({
    doc: initialContents,
    extensions,
  });
}

export function createEditorView(state: EditorState, parent: Element) {
  return new EditorView({ state, parent });
}
